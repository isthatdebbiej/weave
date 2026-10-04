export const dimensionIds = ['product', 'reliability', 'performance', 'devex', 'leverage', 'simplification'] as const;
export type Dimension = typeof dimensionIds[number];
export type Weights = Record<Dimension, number>;
export type Role = 'Driver' | 'Contributor' | 'Reviewer' | 'Adopter';
export interface Engineer { id: string; name: string; avatar: string; url: string }
export interface Evidence { id: string; type: 'pr' | 'issue' | 'review' | 'code'; title: string; url: string; date: string; excerpt: string }
export interface Attribution { engineerId: string; role: Role; rationale: string; evidenceIds: string[] }
export interface Metric { label: string; value: string; context: string; evidenceIds: string[] }
export interface Outcome {
  id: string; initiativeId: string; title: string; summary: string; benefit: string;
  dimension: Dimension; significance: 1 | 3 | 5; significanceRationale: string;
  confidence: 'corroborated' | 'documented'; stage: string; verified: boolean;
  evidenceIds: string[]; participants: Attribution[]; metrics: Metric[];
  followUp: string; limitations: string[];
}
export interface Initiative { id: string; name: string; dimension: Dimension }
export interface Manifest {
  displayName?: string;
  repository: string; start: string; end: string; generatedAt: string;
  expectedPRs: number; collectedPRs: number; uniquePRs: number; screenedPRs: number;
  humanAuthoredPRs: number; botAuthoredPRs: number; reviewedPRs: number;
  complete: boolean; windows: number; reviewedSourceCount: number; notes: string[];
}
export interface ImpactData { version: string; manifest: Manifest; engineers: Engineer[]; initiatives: Initiative[]; outcomes: Outcome[]; evidence: Evidence[] }
export interface RunRecord { startedAt: string; stoppedAt: string | null; budgetSeconds: number; timezone: string }
export interface RankedEngineer { engineer: Engineer; rank: number; score: number; outcomes: Outcome[]; allOutcomes: Outcome[] }
