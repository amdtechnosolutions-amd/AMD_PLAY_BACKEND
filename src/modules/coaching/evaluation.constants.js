/**
 * Evaluation and Performance Assessment Constants & Definitions
 * Matches the Badminton Academy Performance & Feedback scorecard structure.
 */

export const EVALUATION_CATEGORIES = {
  PHYSICAL: 'physical',
  MENTAL: 'mental',
  SKILL: 'skill',
  ATTITUDE: 'attitude',
};

export const DEFAULT_ACADEMY_NAME = 'GIRISH BADMINTON ACADEMY';

export const EVALUATION_METRICS = [
  // --- Physical Attributes (5 metrics, Max Score: 50) ---
  {
    category: EVALUATION_CATEGORIES.PHYSICAL,
    key: 'agility',
    label: 'Agility',
    description: "Agility refers to a player's ability to move quickly and change direction efficiently while maintaining balance and control. It forms the core related physical fitness foundation in the sport.",
    maxScore: 10,
    icon: 'directions_run',
  },
  {
    category: EVALUATION_CATEGORIES.PHYSICAL,
    key: 'speed',
    label: 'Speed',
    description: 'Speed refers to how quickly a player can move across the court, react to opponent shots, and execute footwork mechanics and striking.',
    maxScore: 10,
    icon: 'speed',
  },
  {
    category: EVALUATION_CATEGORIES.PHYSICAL,
    key: 'stamina',
    label: 'Stamina',
    description: "Stamina refers to a player's ability to sustain physical and mental performance over long periods, especially during extended rallies, intense training, or multi-game matches.",
    maxScore: 10,
    icon: 'fitness_center',
  },
  {
    category: EVALUATION_CATEGORIES.PHYSICAL,
    key: 'strength',
    label: 'Strength',
    description: 'Strength refers to a player\'s ability to generate power and withstand physical strain, supporting explosive movements like smashing, jumping and rapidly shifting court positions, and maintaining endurance throughout the game.',
    maxScore: 10,
    icon: 'sports_gymnastics',
  },
  {
    category: EVALUATION_CATEGORIES.PHYSICAL,
    key: 'flexibility',
    label: 'Flexibility',
    description: 'Flexibility refers to a player\'s ability to move joints and muscles through a full range of motion, allowing for quick, efficient, and injury-free movements during play.',
    maxScore: 10,
    icon: 'accessibility_new',
  },

  // --- Mental Attributes (5 metrics, Max Score: 50) ---
  {
    category: EVALUATION_CATEGORIES.MENTAL,
    key: 'focus',
    label: 'Focus',
    description: "Focus in badminton refers to a player's mental sharpness and sustained attention during training and matches.",
    maxScore: 10,
    icon: 'visibility',
  },
  {
    category: EVALUATION_CATEGORIES.MENTAL,
    key: 'confidence',
    label: 'Confidence',
    description: "Confidence is a player's belief in their skills, preparation, and decision-making during play.",
    maxScore: 10,
    icon: 'thumb_up',
  },
  {
    category: EVALUATION_CATEGORIES.MENTAL,
    key: 'composure',
    label: 'Composure',
    description: 'Composure is the ability to stay calm, controlled, and mentally focused, especially during high-pressure situations.',
    maxScore: 10,
    icon: 'psychology',
  },
  {
    category: EVALUATION_CATEGORIES.MENTAL,
    key: 'resilience',
    label: 'Resilience',
    description: 'Resilience is the mental toughness to recover quickly from setbacks, mistakes, or lost points.',
    maxScore: 10,
    icon: 'spa',
  },
  {
    category: EVALUATION_CATEGORIES.MENTAL,
    key: 'sportsmanship',
    label: 'Sportsmanship',
    description: 'Sportsmanship is the spirit of fairness, respect, and integrity towards all involved.',
    maxScore: 10,
    icon: 'military_tech',
  },

  // --- Skill / Technical Attributes (8 metrics, Max Score: 80) ---
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'forehandStrokes',
    label: 'Forehand Strokes',
    description: 'Forehand stroke is typically hitting the shuttle with the palm-side/front of the racket, typically from the racket hand side of the body.',
    maxScore: 10,
    icon: 'sports_tennis',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'backhandStrokes',
    label: 'Backhand Strokes',
    description: 'Backhand strokes are played with the back of the hand facing the shuttle, usually on the non-dominant side of the body.',
    maxScore: 10,
    icon: 'sports_tennis',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'serve',
    label: 'Serve',
    description: "The serve starts the rally and must be hit below waist height, direction and to the opponent's service court.",
    maxScore: 10,
    icon: 'sports_tennis',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'smash',
    label: 'Smash',
    description: 'The smash is a fast, powerful, downward shot hit for points or forced weak returns.',
    maxScore: 10,
    icon: 'flash_on',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'dropShots',
    label: 'Drop Shots',
    description: "A deceptive shot softly placed just over the net and lands close to it in the opponent's front court.",
    maxScore: 10,
    icon: 'arrow_downward',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'footwork',
    label: 'Footwork',
    description: "Footwork refers to a player's movement technique on court, including base recovery, multidirectional changes.",
    maxScore: 10,
    icon: 'directions_walk',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'netPlay',
    label: 'Net Play',
    description: 'Net play involves precise and delicate shots near the net, such as net drops, lifts, and pushes.',
    maxScore: 10,
    icon: 'grid_on',
  },
  {
    category: EVALUATION_CATEGORIES.SKILL,
    key: 'defensiveSkills',
    label: 'Defensive Skills',
    description: 'Defensive skills help a player respond to smashes, drives, and other aggressive shots from the opponent.',
    maxScore: 10,
    icon: 'shield',
  },

  // --- Attitude Attributes (6 metrics, Max Score: 60) ---
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'punctuality',
    label: 'Punctuality',
    description: 'Being consistently on time for training, matches, and team events.',
    maxScore: 10,
    icon: 'access_time',
  },
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'effort',
    label: 'Effort',
    description: 'The physical and mental energy a player puts into training and match play.',
    maxScore: 10,
    icon: 'whatshot',
  },
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'teamwork',
    label: 'Teamwork',
    description: 'Working effectively with others, especially in doubles or team settings.',
    maxScore: 10,
    icon: 'groups',
  },
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'coachability',
    label: 'Coachability',
    description: 'The willingness to listen to feedback and implement suggested improvements.',
    maxScore: 10,
    icon: 'record_voice_over',
  },
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'discipline',
    label: 'Discipline',
    description: 'Maintaining dedication to regular practice and following training guidelines.',
    maxScore: 10,
    icon: 'verified_user',
  },
  {
    category: EVALUATION_CATEGORIES.ATTITUDE,
    key: 'positiveAttitude',
    label: 'Positive Attitude',
    description: 'Displaying optimism, enthusiasm, and a solution-oriented mindset.',
    maxScore: 10,
    icon: 'sentiment_very_satisfied',
  },
];

/**
 * Metric key lookups and category mappings
 */
export const METRIC_MAP = new Map(EVALUATION_METRICS.map((m) => [m.key, m]));

export const CATEGORY_METRICS = {
  [EVALUATION_CATEGORIES.PHYSICAL]: EVALUATION_METRICS.filter((m) => m.category === EVALUATION_CATEGORIES.PHYSICAL),
  [EVALUATION_CATEGORIES.MENTAL]: EVALUATION_METRICS.filter((m) => m.category === EVALUATION_CATEGORIES.MENTAL),
  [EVALUATION_CATEGORIES.SKILL]: EVALUATION_METRICS.filter((m) => m.category === EVALUATION_CATEGORIES.SKILL),
  [EVALUATION_CATEGORIES.ATTITUDE]: EVALUATION_METRICS.filter((m) => m.category === EVALUATION_CATEGORIES.ATTITUDE),
};

export const CATEGORY_MAX_SCORES = {
  [EVALUATION_CATEGORIES.PHYSICAL]: 50,
  [EVALUATION_CATEGORIES.MENTAL]: 50,
  [EVALUATION_CATEGORIES.SKILL]: 80,
  [EVALUATION_CATEGORIES.ATTITUDE]: 60,
};

export const TOTAL_MAX_SCORE = 240;

/**
 * Computes category breakdown, overall percentage, and performance level
 */
export function computeEvaluationSummary(ratings = {}, defaultScore = 10) {
  const categoryScores = {
    [EVALUATION_CATEGORIES.PHYSICAL]: { score: 0, maxScore: CATEGORY_MAX_SCORES.physical, percentage: 0, average: 0 },
    [EVALUATION_CATEGORIES.MENTAL]: { score: 0, maxScore: CATEGORY_MAX_SCORES.mental, percentage: 0, average: 0 },
    [EVALUATION_CATEGORIES.SKILL]: { score: 0, maxScore: CATEGORY_MAX_SCORES.skill, percentage: 0, average: 0 },
    [EVALUATION_CATEGORIES.ATTITUDE]: { score: 0, maxScore: CATEGORY_MAX_SCORES.attitude, percentage: 0, average: 0 },
  };

  for (const metric of EVALUATION_METRICS) {
    const cat = metric.category;
    let val = defaultScore;

    // Check nested ratings.category.key or flat ratings.key
    if (ratings[cat] && ratings[cat][metric.key] !== undefined) {
      val = Number(ratings[cat][metric.key]);
    } else if (ratings[metric.key] !== undefined) {
      val = Number(ratings[metric.key]);
    }

    if (isNaN(val)) val = defaultScore;
    // Clamp value between 0 and 10
    val = Math.max(0, Math.min(10, Math.round(val * 10) / 10));
    categoryScores[cat].score += val;
  }

  // Calculate percentages and averages
  for (const cat of Object.keys(categoryScores)) {
    const item = categoryScores[cat];
    const metricCount = CATEGORY_METRICS[cat].length;
    item.average = Math.round((item.score / metricCount) * 10) / 10;
    item.percentage = Math.round((item.score / item.maxScore) * 1000) / 10;
  }

  const overallScore =
    categoryScores.physical.score +
    categoryScores.mental.score +
    categoryScores.skill.score +
    categoryScores.attitude.score;

  const overallPercentage = Math.round((overallScore / TOTAL_MAX_SCORE) * 1000) / 10;

  let performanceLevel = 'Needs Improvement';
  let grade = 'D';

  if (overallPercentage >= 90) {
    performanceLevel = 'Outstanding';
    grade = 'A+';
  } else if (overallPercentage >= 80) {
    performanceLevel = 'Excellent';
    grade = 'A';
  } else if (overallPercentage >= 70) {
    performanceLevel = 'Good';
    grade = 'B';
  } else if (overallPercentage >= 60) {
    performanceLevel = 'Satisfactory';
    grade = 'C';
  }

  return {
    categoryScores,
    overallScore,
    overallMaxScore: TOTAL_MAX_SCORE,
    overallPercentage,
    performanceLevel,
    grade,
  };
}
