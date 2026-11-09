import mongoose from 'mongoose';
import { DEFAULT_ACADEMY_NAME, computeEvaluationSummary } from './evaluation.constants.js';

const physicalRatingsSchema = new mongoose.Schema(
  {
    agility: { type: Number, min: 0, max: 10, default: 10 },
    speed: { type: Number, min: 0, max: 10, default: 10 },
    stamina: { type: Number, min: 0, max: 10, default: 10 },
    strength: { type: Number, min: 0, max: 10, default: 10 },
    flexibility: { type: Number, min: 0, max: 10, default: 10 },
  },
  { _id: false }
);

const mentalRatingsSchema = new mongoose.Schema(
  {
    focus: { type: Number, min: 0, max: 10, default: 10 },
    confidence: { type: Number, min: 0, max: 10, default: 10 },
    composure: { type: Number, min: 0, max: 10, default: 10 },
    resilience: { type: Number, min: 0, max: 10, default: 10 },
    sportsmanship: { type: Number, min: 0, max: 10, default: 10 },
  },
  { _id: false }
);

const skillRatingsSchema = new mongoose.Schema(
  {
    forehandStrokes: { type: Number, min: 0, max: 10, default: 10 },
    backhandStrokes: { type: Number, min: 0, max: 10, default: 10 },
    serve: { type: Number, min: 0, max: 10, default: 10 },
    smash: { type: Number, min: 0, max: 10, default: 10 },
    dropShots: { type: Number, min: 0, max: 10, default: 10 },
    footwork: { type: Number, min: 0, max: 10, default: 10 },
    netPlay: { type: Number, min: 0, max: 10, default: 10 },
    defensiveSkills: { type: Number, min: 0, max: 10, default: 10 },
  },
  { _id: false }
);

const attitudeRatingsSchema = new mongoose.Schema(
  {
    punctuality: { type: Number, min: 0, max: 10, default: 10 },
    effort: { type: Number, min: 0, max: 10, default: 10 },
    teamwork: { type: Number, min: 0, max: 10, default: 10 },
    coachability: { type: Number, min: 0, max: 10, default: 10 },
    discipline: { type: Number, min: 0, max: 10, default: 10 },
    positiveAttitude: { type: Number, min: 0, max: 10, default: 10 },
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Coach ID is required'],
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      index: true,
    },
    academyName: {
      type: String,
      default: DEFAULT_ACADEMY_NAME,
      trim: true,
    },
    title: {
      type: String,
      default: 'Coach Performance Assessment & Feedback',
      trim: true,
    },
    period: {
      type: String,
      trim: true,
      default: '',
    },
    evaluationDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ratings: {
      physical: { type: physicalRatingsSchema, default: () => ({}) },
      mental: { type: mentalRatingsSchema, default: () => ({}) },
      skill: { type: skillRatingsSchema, default: () => ({}) },
      attitude: { type: attitudeRatingsSchema, default: () => ({}) },
    },
    summary: {
      categoryScores: { type: mongoose.Schema.Types.Mixed },
      overallScore: { type: Number },
      overallMaxScore: { type: Number, default: 240 },
      overallPercentage: { type: Number },
      performanceLevel: { type: String },
      grade: { type: String },
    },
    strengths: {
      type: [String],
      default: [],
    },
    areasForImprovement: {
      type: [String],
      default: [],
    },
    coachRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-compute summary before save
evaluationSchema.pre('save', function (next) {
  const summary = computeEvaluationSummary(this.ratings);
  this.summary = summary;
  next();
});

// Compound indexes for fast query performance
evaluationSchema.index({ tenantId: 1, studentId: 1, evaluationDate: -1 });
evaluationSchema.index({ tenantId: 1, coachId: 1, evaluationDate: -1 });
evaluationSchema.index({ tenantId: 1, batchId: 1, evaluationDate: -1 });
evaluationSchema.index({ tenantId: 1, status: 1 });

export const Evaluation =
  mongoose.models.Evaluation || mongoose.model('Evaluation', evaluationSchema);
