export type DegreeLevel =
  | 'High School'
  | 'Associate'
  | "Bachelor's"
  | "Master's"
  | 'PhD';

export type CareerField =
  | 'Finance & IB'
  | 'Technology'
  | 'Healthcare'
  | 'Law'
  | 'Engineering'
  | 'Education'
  | 'Other';

export type SalaryGoal =
  | 'Under $50k'
  | '$50-80k'
  | '$80-120k'
  | '$120k+';

export type YesNo = 'Yes' | 'No';
export type RiskTolerance = 'Low' | 'Medium' | 'High';

export type FitLabel = 'Strong Match' | 'Good Fit' | 'Consider' | 'Poor Fit';

export type DataQuality = 'real' | 'estimated';

export interface CountyData {
  fips: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  medianIncome: number;
  medianHomePrice: number;
  unemploymentRate: number;
  incomeGrowthScore: number;
  mobilityScore: number;
  housingScore: number;
  employmentScore: number;
  costOfLivingScore: number;
  whyDescription: string;
  // Optional richer fields populated by the data pipeline
  medianRent?: number;
  povertyRate?: number;
  bachelorsRate?: number;
  medianAge?: number;
  dataQuality?: DataQuality;
}

export interface UserProfile {
  age: number;
  degree: DegreeLevel;
  career: CareerField;
  salaryGoal: SalaryGoal;
  remoteWork: YesNo;
  ownHome: YesNo;
  riskTolerance: RiskTolerance;
}

export interface WeightedBreakdown {
  income: number;
  mobility: number;
  housing: number;
  employment: number;
  col: number;
}

export interface ScoredCounty extends CountyData {
  matchScore: number;
  fitLabel: FitLabel;
  weightedBreakdown: WeightedBreakdown;
  tenYearProjection: string;
  reasons: string[];
}
