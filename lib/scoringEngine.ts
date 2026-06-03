import type {
  CareerField,
  CountyData,
  FitLabel,
  ScoredCounty,
  SalaryGoal,
  UserProfile,
  WeightedBreakdown,
} from './data/types';

// ─── Base career weights ─────────────────────────────────────────────────────
const CAREER_WEIGHTS: Record<CareerField, WeightedBreakdown> = {
  'Finance & IB': { income: 0.35, mobility: 0.25, housing: 0.15, employment: 0.15, col: 0.10 },
  'Technology':   { income: 0.25, mobility: 0.20, housing: 0.15, employment: 0.30, col: 0.10 },
  'Healthcare':   { income: 0.20, mobility: 0.25, housing: 0.20, employment: 0.25, col: 0.10 },
  'Law':          { income: 0.30, mobility: 0.25, housing: 0.15, employment: 0.20, col: 0.10 },
  'Engineering':  { income: 0.25, mobility: 0.25, housing: 0.20, employment: 0.20, col: 0.10 },
  'Education':    { income: 0.25, mobility: 0.25, housing: 0.20, employment: 0.20, col: 0.10 },
  'Other':        { income: 0.25, mobility: 0.25, housing: 0.20, employment: 0.20, col: 0.10 },
};

// Career → expected salary multiplier vs. county median income
const CAREER_SALARY_MULTIPLIER: Record<CareerField, number> = {
  'Finance & IB': 1.6,
  'Technology': 1.5,
  'Healthcare': 1.3,
  'Law': 1.5,
  'Engineering': 1.3,
  'Education': 0.9,
  'Other': 1.0,
};

// User salary goal floors — bumps the assumed income if higher than the multiplier output
const SALARY_GOAL_FLOOR: Record<SalaryGoal, number> = {
  'Under $50k': 40000,
  '$50-80k': 65000,
  '$80-120k': 100000,
  '$120k+': 140000,
};

/**
 * Compute personalized weights for this user profile.
 * Starts from career base weights, applies modifiers, then renormalizes to sum to 1.
 */
export function computeWeights(profile: UserProfile): WeightedBreakdown {
  const base = { ...CAREER_WEIGHTS[profile.career] };

  if (profile.remoteWork === 'Yes') base.housing += 0.15;
  if (profile.ownHome === 'Yes') base.housing += 0.10;
  if (profile.age < 25) base.mobility += 0.10;
  if (profile.age > 40) {
    base.housing += 0.10;
    base.income += 0.05;
  }
  if (profile.riskTolerance === 'High') {
    base.income += 0.10;
    base.housing -= 0.05;
  }
  if (profile.riskTolerance === 'Low') {
    base.col += 0.10;
    base.income -= 0.05;
  }

  // Clamp negatives to 0 then renormalize
  const clamped: WeightedBreakdown = {
    income: Math.max(0, base.income),
    mobility: Math.max(0, base.mobility),
    housing: Math.max(0, base.housing),
    employment: Math.max(0, base.employment),
    col: Math.max(0, base.col),
  };
  const total =
    clamped.income + clamped.mobility + clamped.housing + clamped.employment + clamped.col;
  return {
    income: clamped.income / total,
    mobility: clamped.mobility / total,
    housing: clamped.housing / total,
    employment: clamped.employment / total,
    col: clamped.col / total,
  };
}

/**
 * Compute the weighted 0–100 match score for a county against a profile.
 */
function computeMatchScore(county: CountyData, weights: WeightedBreakdown): number {
  return (
    county.incomeGrowthScore * weights.income +
    county.mobilityScore * weights.mobility +
    county.housingScore * weights.housing +
    county.employmentScore * weights.employment +
    county.costOfLivingScore * weights.col
  );
}

/**
 * Compound an estimated annual savings amount over 10 years at 6% annual return.
 * Returns a formatted USD string.
 */
function computeTenYearProjection(
  county: CountyData,
  profile: UserProfile
): string {
  const expectedIncome = Math.max(
    county.medianIncome * CAREER_SALARY_MULTIPLIER[profile.career],
    SALARY_GOAL_FLOOR[profile.salaryGoal]
  );
  // Annual housing cost ~ 5% of median home price (mortgage/rent proxy)
  const annualHousing = county.medianHomePrice * 0.05;
  // Cost-of-living adjustment: lower COL score → higher subtraction (max ~$24k for COL score=0)
  const colAdjustment = (100 - county.costOfLivingScore) * 240;

  const annualSavings = Math.max(0, expectedIncome - annualHousing - colAdjustment);

  // Compound annually at 6% with contributions at year end
  const rate = 0.06;
  const years = 10;
  let total = 0;
  for (let i = 0; i < years; i++) total = (total + annualSavings) * (1 + rate);

  if (total <= 0) return '$0';
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(total / 1000)}k`;
}

function fitLabelFor(score: number): FitLabel {
  if (score >= 85) return 'Strong Match';
  if (score >= 72) return 'Good Fit';
  if (score >= 60) return 'Consider';
  return 'Poor Fit';
}

/**
 * Produce 2–3 plain English reasons explaining this county's score for this profile.
 */
function buildReasons(county: CountyData, weights: WeightedBreakdown): string[] {
  const reasons: string[] = [];
  const dims: Array<[string, number, number]> = [
    ['income growth', county.incomeGrowthScore, weights.income],
    ['economic mobility', county.mobilityScore, weights.mobility],
    ['housing affordability', county.housingScore, weights.housing],
    ['employment growth', county.employmentScore, weights.employment],
    ['cost of living', county.costOfLivingScore, weights.col],
  ];

  // Highlight the two highest weighted dimensions
  const ranked = [...dims].sort((a, b) => b[2] - a[2]);
  for (const [label, score] of ranked.slice(0, 2)) {
    if (score >= 80) {
      reasons.push(`Strong ${label} for your profile (${score}/100).`);
    } else if (score >= 60) {
      reasons.push(`Solid ${label} (${score}/100) for your priorities.`);
    } else {
      reasons.push(`${label[0].toUpperCase() + label.slice(1)} is a weak point here (${score}/100).`);
    }
  }
  // Add an affordability flag if housing is poor and weighted meaningfully
  if (county.housingScore < 40 && weights.housing > 0.1) {
    reasons.push('Housing costs significantly drag the wealth math here.');
  }
  return reasons.slice(0, 3);
}

/**
 * Score every county for a given profile and return them ranked descending by matchScore.
 */
export function scoreCounties(
  counties: CountyData[],
  profile: UserProfile
): ScoredCounty[] {
  const weights = computeWeights(profile);
  return counties
    .map((county) => {
      const matchScore = Math.round(computeMatchScore(county, weights));
      return {
        ...county,
        matchScore,
        fitLabel: fitLabelFor(matchScore),
        weightedBreakdown: weights,
        tenYearProjection: computeTenYearProjection(county, profile),
        reasons: buildReasons(county, weights),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Map a score (0–100) to a hex color along the red→yellow→teal gradient.
 * Used for choropleth fill on the map.
 */
export function scoreToColor(score: number): string {
  // 0..40 red, 40..70 yellow, 70..100 teal
  if (score <= 40) return '#ef4444';
  if (score <= 70) return '#fbbf24';
  return '#00d4ff';
}

/**
 * Default user profile used before personalization.
 */
export const DEFAULT_PROFILE: UserProfile = {
  age: 22,
  degree: "Bachelor's",
  career: 'Other',
  salaryGoal: '$50-80k',
  remoteWork: 'No',
  ownHome: 'No',
  riskTolerance: 'Medium',
};
