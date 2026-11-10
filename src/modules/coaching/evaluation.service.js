import mongoose from 'mongoose';
import { Evaluation } from './evaluation.model.js';
import { User } from '../users/user.model.js';
import { Batch } from './batch.model.js';
import { Enrollment } from './enrollment.model.js';
import { Sport } from '../sports/sport.model.js';
import { Branch } from '../branches/branch.model.js';
import {
  EVALUATION_CATEGORIES,
  EVALUATION_METRICS,
  CATEGORY_METRICS,
  CATEGORY_MAX_SCORES,
  TOTAL_MAX_SCORE,
  DEFAULT_ACADEMY_NAME,
  computeEvaluationSummary,
} from './evaluation.constants.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../../errors/AppError.js';
import { ROLES } from '../../config/constants.js';

export class EvaluationService {
  /**
   * Get dynamic evaluation template with categories, 24 metrics, definitions, and max scores
   */
  getTemplate() {
    return {
      academyName: DEFAULT_ACADEMY_NAME,
      title: 'Coach Performance Assessment & Feedback',
      totalMaxScore: TOTAL_MAX_SCORE,
      categories: [
        {
          key: EVALUATION_CATEGORIES.PHYSICAL,
          label: 'Physical',
          maxScore: CATEGORY_MAX_SCORES.physical,
          metricCount: CATEGORY_METRICS.physical.length,
          metrics: CATEGORY_METRICS.physical,
        },
        {
          key: EVALUATION_CATEGORIES.MENTAL,
          label: 'Mental',
          maxScore: CATEGORY_MAX_SCORES.mental,
          metricCount: CATEGORY_METRICS.mental.length,
          metrics: CATEGORY_METRICS.mental,
        },
        {
          key: EVALUATION_CATEGORIES.SKILL,
          label: 'Skill',
          maxScore: CATEGORY_MAX_SCORES.skill,
          metricCount: CATEGORY_METRICS.skill.length,
          metrics: CATEGORY_METRICS.skill,
        },
        {
          key: EVALUATION_CATEGORIES.ATTITUDE,
          label: 'Attitude',
          maxScore: CATEGORY_MAX_SCORES.attitude,
          metricCount: CATEGORY_METRICS.attitude.length,
          metrics: CATEGORY_METRICS.attitude,
        },
      ],
      allMetrics: EVALUATION_METRICS,
    };
  }

  /**
   * Helper to extract numeric value from candidate keys in a source object
   */
  _extractCategoryValue(source, keys) {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        const num = Number(source[key]);
        if (!isNaN(num)) return num;
      }
    }
    return undefined;
  }

  /**
   * Helper to normalize input ratings (supports category totals out of 60/50/10,
   * flat metric maps, and nested category-metric objects).
   */
  _normalizeRatings(input = {}) {
    const data = typeof input === 'object' && input !== null ? input : {};
    const ratingsObj =
      typeof data.ratings === 'object' && data.ratings !== null ? data.ratings : {};

    const categoryKeys = {
      physical: [
        'physical',
        'physicalScore',
        'physicalCondition',
        'physicalConditionAndStamina',
        'physical_condition',
        'physical_condition_and_stamina',
        'physicalConditionStamina',
        'stamina',
        'fitness',
      ],
      mental: [
        'mental',
        'mentalScore',
        'mentalFocus',
        'mentalFocusAndResilience',
        'mental_focus',
        'mental_focus_and_resilience',
        'mentalFocusResilience',
        'focusAndResilience',
        'focus',
      ],
      skill: [
        'skill',
        'skills',
        'skillScore',
        'technical',
        'technicalSkill',
        'technicalSkillAndExecution',
        'technical_skill',
        'technical_skill_and_execution',
        'technicalSkillExecution',
        'skillAndExecution',
        'execution',
      ],
      attitude: [
        'attitude',
        'attitudeScore',
        'attitudeAndDiscipline',
        'attitude_and_discipline',
        'attitudeDiscipline',
        'discipline',
        'behavior',
        'disciplineAndAttitude',
      ],
    };

    const normalized = {
      physical: {},
      mental: {},
      skill: {},
      attitude: {},
    };

    for (const cat of [
      EVALUATION_CATEGORIES.PHYSICAL,
      EVALUATION_CATEGORIES.MENTAL,
      EVALUATION_CATEGORIES.SKILL,
      EVALUATION_CATEGORIES.ATTITUDE,
    ]) {
      // Find category total score (passed inside ratings or top-level)
      const catVal =
        this._extractCategoryValue(ratingsObj, categoryKeys[cat]) ??
        this._extractCategoryValue(data, categoryKeys[cat]);

      // Category baseline on 0-10 scale
      let categoryDefault = 10;
      if (catVal !== undefined) {
        if (catVal > 60) {
          // Scale 0-100 to 0-10
          categoryDefault = (Math.min(100, Math.max(0, catVal)) / 100) * 10;
        } else if (catVal > 10) {
          // In mobile UI, sliders are scored 0 - 60 pts
          categoryDefault = (Math.min(60, Math.max(0, catVal)) / 60) * 10;
        } else {
          categoryDefault = Math.max(0, Math.min(10, catVal));
        }
      }

      // Populate each metric under this category
      const metrics = CATEGORY_METRICS[cat] || [];
      for (const metric of metrics) {
        let val = categoryDefault;

        // Specific sub-metric overrides (nested in ratingsObj[cat], flat in ratingsObj, or root)
        const nestedVal = ratingsObj[cat]?.[metric.key];
        const flatRatingsVal = ratingsObj[metric.key];
        const topVal = data[metric.key];

        if (nestedVal !== undefined && nestedVal !== null && nestedVal !== '') {
          const n = Number(nestedVal);
          if (!isNaN(n)) val = n;
        } else if (flatRatingsVal !== undefined && flatRatingsVal !== null && flatRatingsVal !== '') {
          const n = Number(flatRatingsVal);
          if (!isNaN(n)) val = n;
        } else if (topVal !== undefined && topVal !== null && topVal !== '') {
          const n = Number(topVal);
          if (!isNaN(n)) val = n;
        }

        // Clamp between 0 and 10 and round to 1 decimal place
        val = Math.max(0, Math.min(10, Math.round(Number(val) * 10) / 10));
        normalized[cat][metric.key] = val;
      }
    }

    return normalized;
  }

  /**
   * Create a new student evaluation / feedback by Coach
   */
  async createEvaluation(data, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const currentUserId = context.user?.id || context.user?.sub;

    const studentId = data.studentId;
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ValidationError('Valid studentId is required to submit coach evaluation');
    }

    // Verify student exists in current tenant
    const student = await User.findOne({ _id: studentId, tenantId });
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found in this academy`);
    }

    // Determine coach ID
    let coachId = currentUserId;
    if (data.coachId && mongoose.Types.ObjectId.isValid(data.coachId)) {
      const coach = await User.findOne({ _id: data.coachId, tenantId });
      if (coach) coachId = coach._id;
    }

    // Resolve batch (if provided or from active enrollment)
    let batchId = data.batchId && mongoose.Types.ObjectId.isValid(data.batchId) ? data.batchId : null;
    let branchId =
      data.branchId && mongoose.Types.ObjectId.isValid(data.branchId)
        ? data.branchId
        : student.branchId || context.branchId || null;
    let sportId = data.sportId && mongoose.Types.ObjectId.isValid(data.sportId) ? data.sportId : null;

    if (batchId) {
      const batch = await Batch.findOne({ _id: batchId, tenantId });
      if (batch) {
        branchId = branchId || batch.branchId;
        sportId = sportId || batch.sportId;
      }
    } else {
      // Find active enrollment
      const enr = await Enrollment.findOne({ tenantId, studentId, status: 'active' }).populate('batchId');
      if (enr && enr.batchId) {
        batchId = enr.batchId._id;
        branchId = branchId || enr.batchId.branchId;
        sportId = sportId || enr.batchId.sportId;
      }
    }

    // Parse evaluation date safely
    let evalDate = new Date();
    if (data.evaluationDate) {
      const parsed = new Date(data.evaluationDate);
      if (!isNaN(parsed.getTime())) {
        evalDate = parsed;
      }
    }

    // Normalize ratings from category sliders or detailed metric inputs
    const ratings = this._normalizeRatings(data);
    const summary = computeEvaluationSummary(ratings);

    // Check if an existing evaluation exists to UPDATE instead of creating a duplicate
    let evaluation = null;
    const explicitId = data.id || data._id || data.evaluationId;
    if (explicitId && mongoose.Types.ObjectId.isValid(explicitId)) {
      evaluation = await Evaluation.findOne({ _id: explicitId, tenantId });
    }

    if (!evaluation) {
      // Find existing evaluation for this student in this batch/tenant
      const query = { tenantId, studentId };
      if (batchId) query.batchId = batchId;
      evaluation = await Evaluation.findOne(query).sort({ evaluationDate: -1, createdAt: -1 });
    }

    if (evaluation) {
      // UPDATE EXISTING RECORD IN-PLACE
      evaluation.ratings = ratings;
      evaluation.summary = summary;
      evaluation.evaluationDate = evalDate;
      evaluation.coachId = coachId;
      if (batchId) evaluation.batchId = batchId;
      if (branchId) evaluation.branchId = branchId;
      if (sportId) evaluation.sportId = sportId;
      if (data.academyName) evaluation.academyName = data.academyName;
      if (data.title) evaluation.title = data.title;
      if (data.period !== undefined) evaluation.period = data.period;
      if (data.strengths) {
        evaluation.strengths = Array.isArray(data.strengths)
          ? data.strengths
          : [data.strengths];
      }
      if (data.areasForImprovement) {
        evaluation.areasForImprovement = Array.isArray(data.areasForImprovement)
          ? data.areasForImprovement
          : [data.areasForImprovement];
      }
      if (data.coachRemarks || data.feedback || data.remarks) {
        evaluation.coachRemarks = (data.coachRemarks || data.feedback || data.remarks).trim();
      }
      if (data.status) evaluation.status = data.status;

      await evaluation.save();
      return await this.getEvaluationById(evaluation._id, context);
    }

    // If no existing record found, CREATE NEW
    evaluation = new Evaluation({
      tenantId,
      branchId,
      studentId,
      coachId,
      batchId,
      sportId,
      academyName: data.academyName || DEFAULT_ACADEMY_NAME,
      title: data.title || 'Coach Performance Assessment & Feedback',
      period: data.period || '',
      evaluationDate: evalDate,
      ratings,
      summary,
      strengths: Array.isArray(data.strengths)
        ? data.strengths
        : data.strengths
          ? [data.strengths]
          : [],
      areasForImprovement: Array.isArray(data.areasForImprovement)
        ? data.areasForImprovement
        : data.areasForImprovement
          ? [data.areasForImprovement]
          : [],
      coachRemarks: (data.coachRemarks || data.feedback || data.remarks || '').trim(),
      status: data.status || 'published',
    });

    await evaluation.save();

    return await this.getEvaluationById(evaluation._id, context);
  }

  /**
   * Update an existing evaluation
   */
  async updateEvaluation(id, data, context = {}) {
    const tenantId = context.tenantId;
    const currentUserId = context.user?.id || context.user?.sub;
    const currentUserRole = context.user?.role;

    const query = { _id: id, tenantId };
    const evaluation = await Evaluation.findOne(query);
    if (!evaluation) {
      throw new NotFoundError(`Evaluation with ID '${id}' not found`);
    }

    // Role check: Only the authoring coach or academy admin can edit
    if (
      currentUserRole === ROLES.COACH &&
      evaluation.coachId.toString() !== currentUserId?.toString()
    ) {
      throw new AuthorizationError('You can only edit your own student evaluations');
    }

    if (
      data.ratings ||
      data.physical ||
      data.mental ||
      data.skill ||
      data.attitude ||
      data.physicalScore ||
      data.mentalScore ||
      data.skillScore ||
      data.attitudeScore
    ) {
      const current = evaluation.ratings?.toObject ? evaluation.ratings.toObject() : evaluation.ratings || {};
      const updated = this._normalizeRatings(data);
      evaluation.ratings = {
        physical: { ...(current.physical || {}), ...(updated.physical || {}) },
        mental: { ...(current.mental || {}), ...(updated.mental || {}) },
        skill: { ...(current.skill || {}), ...(updated.skill || {}) },
        attitude: { ...(current.attitude || {}), ...(updated.attitude || {}) },
      };
      evaluation.summary = computeEvaluationSummary(evaluation.ratings);
    }

    if (data.academyName !== undefined) evaluation.academyName = data.academyName;
    if (data.title !== undefined) evaluation.title = data.title;
    if (data.period !== undefined) evaluation.period = data.period;
    if (data.evaluationDate !== undefined) {
      const parsed = new Date(data.evaluationDate);
      if (!isNaN(parsed.getTime())) evaluation.evaluationDate = parsed;
    }
    if (data.strengths !== undefined) {
      evaluation.strengths = Array.isArray(data.strengths) ? data.strengths : data.strengths ? [data.strengths] : [];
    }
    if (data.areasForImprovement !== undefined) {
      evaluation.areasForImprovement = Array.isArray(data.areasForImprovement)
        ? data.areasForImprovement
        : data.areasForImprovement
          ? [data.areasForImprovement]
          : [];
    }
    if (data.coachRemarks !== undefined) evaluation.coachRemarks = data.coachRemarks.trim();
    if (data.feedback !== undefined) evaluation.coachRemarks = data.feedback.trim();
    if (data.remarks !== undefined) evaluation.coachRemarks = data.remarks.trim();
    if (data.status !== undefined) evaluation.status = data.status;

    await evaluation.save();

    return await this.getEvaluationById(evaluation._id, context);
  }

  /**
   * Get single evaluation by ID with populated references and formatted parameter cards
   */
  async getEvaluationById(id, context = {}) {
    const tenantId = context.tenantId;
    const query = { _id: id };
    if (tenantId) query.tenantId = tenantId;

    const evaluation = await Evaluation.findOne(query)
      .populate('studentId', 'firstName lastName email phone employeeNo cardNo metadata')
      .populate('coachId', 'firstName lastName email phone')
      .populate('batchId', 'name code level schedule')
      .populate('sportId', 'name slug')
      .populate('branchId', 'name code')
      .lean();

    if (!evaluation) {
      throw new NotFoundError(`Evaluation with ID '${id}' not found`);
    }

    // Format parameter cards with labels and descriptions from metadata
    const parameterCards = EVALUATION_METRICS.map((metric) => {
      const cat = metric.category;
      const score = evaluation.ratings?.[cat]?.[metric.key] ?? 10;
      return {
        category: cat,
        key: metric.key,
        label: metric.label,
        description: metric.description,
        score,
        maxScore: metric.maxScore,
        percentage: Math.round((score / metric.maxScore) * 100),
        icon: metric.icon,
      };
    });

    const radarData = [
      {
        category: 'Physical',
        key: 'physical',
        score: evaluation.summary?.categoryScores?.physical?.score || 0,
        maxScore: CATEGORY_MAX_SCORES.physical,
        percentage: evaluation.summary?.categoryScores?.physical?.percentage || 0,
        average: evaluation.summary?.categoryScores?.physical?.average || 0,
      },
      {
        category: 'Mental',
        key: 'mental',
        score: evaluation.summary?.categoryScores?.mental?.score || 0,
        maxScore: CATEGORY_MAX_SCORES.mental,
        percentage: evaluation.summary?.categoryScores?.mental?.percentage || 0,
        average: evaluation.summary?.categoryScores?.mental?.average || 0,
      },
      {
        category: 'Skill',
        key: 'skill',
        score: evaluation.summary?.categoryScores?.skill?.score || 0,
        maxScore: CATEGORY_MAX_SCORES.skill,
        percentage: evaluation.summary?.categoryScores?.skill?.percentage || 0,
        average: evaluation.summary?.categoryScores?.skill?.average || 0,
      },
      {
        category: 'Attitude',
        key: 'attitude',
        score: evaluation.summary?.categoryScores?.attitude?.score || 0,
        maxScore: CATEGORY_MAX_SCORES.attitude,
        percentage: evaluation.summary?.categoryScores?.attitude?.percentage || 0,
        average: evaluation.summary?.categoryScores?.attitude?.average || 0,
      },
    ];

    return {
      ...evaluation,
      parameterCards,
      radarData,
    };
  }

  /**
   * List evaluations with filters and pagination.
   * By default, groups by studentId to return only the latest evaluation record per student,
   * preventing duplicate cards for the same student on the screen.
   */
  async listEvaluations(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      tenantId: mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId,
    };

    if (filters.studentId && mongoose.Types.ObjectId.isValid(filters.studentId)) {
      query.studentId = new mongoose.Types.ObjectId(filters.studentId);
    }
    if (filters.coachId && mongoose.Types.ObjectId.isValid(filters.coachId)) {
      query.coachId = new mongoose.Types.ObjectId(filters.coachId);
    }
    if (filters.batchId && mongoose.Types.ObjectId.isValid(filters.batchId)) {
      query.batchId = new mongoose.Types.ObjectId(filters.batchId);
    }
    if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
      query.branchId = new mongoose.Types.ObjectId(filters.branchId);
    }
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.evaluationDate = {};
      if (filters.dateFrom && !isNaN(new Date(filters.dateFrom).getTime())) {
        query.evaluationDate.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo && !isNaN(new Date(filters.dateTo).getTime())) {
        query.evaluationDate.$lte = new Date(filters.dateTo);
      }
      if (Object.keys(query.evaluationDate).length === 0) {
        delete query.evaluationDate;
      }
    }

    // Support search by student name or regNo
    if (filters.search || filters.q) {
      const searchTerm = String(filters.search || filters.q).trim();
      if (searchTerm) {
        const regex = new RegExp(searchTerm, 'i');
        const matchingStudents = await User.find({
          tenantId,
          $or: [
            { firstName: regex },
            { lastName: regex },
            { employeeNo: regex },
            { phone: regex },
          ],
        }).select('_id');
        const matchedIds = matchingStudents.map((s) => new mongoose.Types.ObjectId(s._id));
        if (query.studentId) {
          if (!matchedIds.some((id) => id.equals(query.studentId))) {
            return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
          }
        } else {
          query.studentId = { $in: matchedIds };
        }
      }
    }

    const showAllHistory = filters.allHistory === true || filters.allHistory === 'true';

    let items = [];
    let total = 0;

    if (showAllHistory) {
      // Detailed raw history without deduplication
      [items, total] = await Promise.all([
        Evaluation.find(query)
          .populate('studentId', 'firstName lastName employeeNo cardNo phone metadata branchId')
          .populate('coachId', 'firstName lastName email phone')
          .populate('batchId', 'name code level schedule')
          .populate('sportId', 'name slug')
          .populate('branchId', 'name code')
          .sort({ evaluationDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Evaluation.countDocuments(query),
      ]);
    } else {
      // Deduplicate by studentId: Each student appears ONCE with their latest evaluation
      const pipeline = [
        { $match: query },
        { $sort: { evaluationDate: -1, createdAt: -1 } },
        {
          $group: {
            _id: '$studentId',
            doc: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { evaluationDate: -1, createdAt: -1 } },
      ];

      const countResult = await Evaluation.aggregate([...pipeline, { $count: 'total' }]);
      total = countResult[0]?.total || 0;

      const groupedDocs = await Evaluation.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
      ]);

      items = await Evaluation.populate(groupedDocs, [
        { path: 'studentId', select: 'firstName lastName employeeNo cardNo phone metadata branchId' },
        { path: 'coachId', select: 'firstName lastName email phone' },
        { path: 'batchId', select: 'name code level schedule' },
        { path: 'sportId', select: 'name slug' },
        { path: 'branchId', select: 'name code' },
      ]);
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete an evaluation
   */
  async deleteEvaluation(id, context = {}) {
    const tenantId = context.tenantId;
    const evaluation = await Evaluation.findOne({ _id: id, tenantId });
    if (!evaluation) {
      throw new NotFoundError(`Evaluation with ID '${id}' not found`);
    }

    await Evaluation.deleteOne({ _id: id, tenantId });
    return {
      success: true,
      message: 'Evaluation report deleted successfully',
    };
  }

  /**
   * Get complete performance report cards & progress trends for a student
   */
  async getStudentEvaluationReports(studentId, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const student = await User.findOne({ _id: studentId, tenantId })
      .select('-password')
      .lean();

    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found`);
    }

    const evaluations = await Evaluation.find({
      tenantId,
      studentId,
      status: 'published',
    })
      .populate('coachId', 'firstName lastName email')
      .populate('batchId', 'name code level')
      .populate('sportId', 'name slug')
      .sort({ evaluationDate: -1 })
      .lean();

    if (evaluations.length === 0) {
      return {
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName || ''}`.trim(),
          regNo: student.employeeNo || '',
          phone: student.phone || '',
        },
        hasEvaluations: false,
        totalEvaluations: 0,
        evaluations: [],
        latestEvaluation: null,
        summary: {
          overallScore: 0,
          overallPercentage: 0,
          performanceLevel: 'Pending Assessment',
          grade: 'N/A',
        },
        trend: [],
        radarData: [],
        parameterCards: [],
      };
    }

    // Most recent evaluation
    const latestRaw = evaluations[0];
    const latestDetailed = await this.getEvaluationById(latestRaw._id, context);

    // Build historical progress trend (in chronological order)
    const trend = [...evaluations]
      .reverse()
      .map((ev) => ({
        id: ev._id,
        date: ev.evaluationDate,
        title: ev.title || 'Assessment',
        period: ev.period || '',
        overallScore: ev.summary?.overallScore || 0,
        overallPercentage: ev.summary?.overallPercentage || 0,
        physicalScore: ev.summary?.categoryScores?.physical?.score || 0,
        mentalScore: ev.summary?.categoryScores?.mental?.score || 0,
        skillScore: ev.summary?.categoryScores?.skill?.score || 0,
        attitudeScore: ev.summary?.categoryScores?.attitude?.score || 0,
        performanceLevel: ev.summary?.performanceLevel || 'Satisfactory',
        grade: ev.summary?.grade || 'C',
      }));

    return {
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        regNo: student.employeeNo || '',
        phone: student.phone || '',
        branchId: student.branchId,
      },
      hasEvaluations: true,
      totalEvaluations: evaluations.length,
      latestEvaluation: latestDetailed,
      evaluations,
      trend,
      radarData: latestDetailed.radarData,
      parameterCards: latestDetailed.parameterCards,
      summary: {
        latestOverallScore: latestDetailed.summary?.overallScore,
        latestOverallPercentage: latestDetailed.summary?.overallPercentage,
        performanceLevel: latestDetailed.summary?.performanceLevel,
        grade: latestDetailed.summary?.grade,
        coachRemarks: latestDetailed.coachRemarks,
        strengths: latestDetailed.strengths,
        areasForImprovement: latestDetailed.areasForImprovement,
        latestEvaluationDate: latestDetailed.evaluationDate,
        coachName: latestDetailed.coachId
          ? `${latestDetailed.coachId.firstName} ${latestDetailed.coachId.lastName || ''}`.trim()
          : 'Coach',
      },
    };
  }
}

export const evaluationService = new EvaluationService();
