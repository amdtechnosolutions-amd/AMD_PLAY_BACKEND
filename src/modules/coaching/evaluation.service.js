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
   * Helper to normalize input ratings (supports both flat and nested objects)
   */
  _normalizeRatings(inputRatings = {}) {
    const normalized = {
      physical: {},
      mental: {},
      skill: {},
      attitude: {},
    };

    for (const metric of EVALUATION_METRICS) {
      const cat = metric.category;
      let val = 10; // baseline default score is 10

      if (inputRatings[cat] && inputRatings[cat][metric.key] !== undefined) {
        val = Number(inputRatings[cat][metric.key]);
      } else if (inputRatings[metric.key] !== undefined) {
        val = Number(inputRatings[metric.key]);
      }

      if (isNaN(val)) val = 10;
      val = Math.max(0, Math.min(10, Math.round(val * 10) / 10));
      normalized[cat][metric.key] = val;
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
    const currentUserRole = context.user?.role;

    const studentId = data.studentId;
    if (!studentId) {
      throw new ValidationError('studentId is required to submit coach evaluation');
    }

    // Verify student exists in current tenant
    const student = await User.findOne({ _id: studentId, tenantId, role: ROLES.STUDENT });
    if (!student) {
      throw new NotFoundError(`Student with ID '${studentId}' not found in this academy`);
    }

    // Determine coach ID
    let coachId = currentUserId;
    if (data.coachId) {
      // If admin or manager creates on behalf of a coach
      const coach = await User.findOne({ _id: data.coachId, tenantId });
      if (coach) coachId = coach._id;
    }

    // Resolve batch (if provided or from active enrollment)
    let batchId = data.batchId || null;
    let branchId = data.branchId || student.branchId || context.branchId || null;
    let sportId = data.sportId || null;

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

    // Normalize ratings
    const ratings = this._normalizeRatings(data.ratings || data);
    const summary = computeEvaluationSummary(ratings);

    const evaluation = new Evaluation({
      tenantId,
      branchId,
      studentId,
      coachId,
      batchId,
      sportId,
      academyName: data.academyName || DEFAULT_ACADEMY_NAME,
      title: data.title || 'Coach Performance Assessment & Feedback',
      period: data.period || '',
      evaluationDate: data.evaluationDate ? new Date(data.evaluationDate) : new Date(),
      ratings,
      summary,
      strengths: Array.isArray(data.strengths) ? data.strengths : data.strengths ? [data.strengths] : [],
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

    if (data.ratings || data.physical || data.mental || data.skill || data.attitude) {
      const mergedRatings = {
        physical: { ...(evaluation.ratings?.physical?.toObject?.() || evaluation.ratings?.physical || {}), ...(data.ratings?.physical || data.physical || {}) },
        mental: { ...(evaluation.ratings?.mental?.toObject?.() || evaluation.ratings?.mental || {}), ...(data.ratings?.mental || data.mental || {}) },
        skill: { ...(evaluation.ratings?.skill?.toObject?.() || evaluation.ratings?.skill || {}), ...(data.ratings?.skill || data.skill || {}) },
        attitude: { ...(evaluation.ratings?.attitude?.toObject?.() || evaluation.ratings?.attitude || {}), ...(data.ratings?.attitude || data.attitude || {}) },
      };
      evaluation.ratings = this._normalizeRatings(mergedRatings);
      evaluation.summary = computeEvaluationSummary(evaluation.ratings);
    }

    if (data.academyName !== undefined) evaluation.academyName = data.academyName;
    if (data.title !== undefined) evaluation.title = data.title;
    if (data.period !== undefined) evaluation.period = data.period;
    if (data.evaluationDate !== undefined) evaluation.evaluationDate = new Date(data.evaluationDate);
    if (data.strengths !== undefined) evaluation.strengths = Array.isArray(data.strengths) ? data.strengths : [data.strengths];
    if (data.areasForImprovement !== undefined) {
      evaluation.areasForImprovement = Array.isArray(data.areasForImprovement)
        ? data.areasForImprovement
        : [data.areasForImprovement];
    }
    if (data.coachRemarks !== undefined) evaluation.coachRemarks = data.coachRemarks.trim();
    if (data.feedback !== undefined) evaluation.coachRemarks = data.feedback.trim();
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
   * List evaluations with filters and pagination
   */
  async listEvaluations(filters = {}, pagination = {}, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant context is required');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = { tenantId };

    if (filters.studentId) query.studentId = filters.studentId;
    if (filters.coachId) query.coachId = filters.coachId;
    if (filters.batchId) query.batchId = filters.batchId;
    if (filters.branchId) query.branchId = filters.branchId;
    if (filters.status) query.status = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      query.evaluationDate = {};
      if (filters.dateFrom) query.evaluationDate.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.evaluationDate.$lte = new Date(filters.dateTo);
    }

    const [items, total] = await Promise.all([
      Evaluation.find(query)
        .populate('studentId', 'firstName lastName employeeNo cardNo phone')
        .populate('coachId', 'firstName lastName')
        .populate('batchId', 'name code')
        .sort({ evaluationDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Evaluation.countDocuments(query),
    ]);

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

    const student = await User.findOne({ _id: studentId, tenantId, role: ROLES.STUDENT })
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
