import { dimensionIds, type Dimension, type ImpactData, type Outcome, type RankedEngineer, type Weights } from './types.ts';

export const equalWeights: Weights = { product: 1, reliability: 1, performance: 1, devex: 1, leverage: 1, simplification: 1 };
export function normalizeWeights(input: Weights): Weights {
  const clean = Object.fromEntries(dimensionIds.map(id => [id, Number.isFinite(input[id]) ? Math.max(0, input[id]) : 0])) as Weights;
  const total = dimensionIds.reduce((sum, id) => sum + clean[id], 0);
  if (!total) return Object.fromEntries(dimensionIds.map(id => [id, 1 / 6])) as Weights;
  return Object.fromEntries(dimensionIds.map(id => [id, clean[id] / total])) as Weights;
}
export function lensWeights(dimension: Dimension | 'overall'): Weights {
  return dimension === 'overall' ? { ...equalWeights } : Object.fromEntries(dimensionIds.map(id => [id, id === dimension ? 1 : 0])) as Weights;
}
export function contributionValue(outcome: Outcome, weights: Weights): number { return outcome.significance * weights[outcome.dimension]; }
export function rankEngineers(data: ImpactData, priorities: Weights): RankedEngineer[] {
  const weights = normalizeWeights(priorities);
  const unique = [...new Map(data.outcomes.filter(o => o.verified).map(o => [o.id, o])).values()];
  const ranked = data.engineers.map(engineer => {
    const allOutcomes = unique.filter(o => o.participants.some(p => p.engineerId === engineer.id && p.evidenceIds.length > 0))
      .sort((a, b) => contributionValue(b, weights) - contributionValue(a, weights) || b.significance - a.significance || a.id.localeCompare(b.id));
    const outcomes = allOutcomes.filter(o => contributionValue(o, weights) > 0).slice(0, 3);
    return { engineer, allOutcomes, outcomes, score: outcomes.reduce((sum, o) => sum + contributionValue(o, weights), 0), rank: 0 };
  }).filter(r => r.score > 0)
    .sort((a, b) => Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.engineer.name.localeCompare(b.engineer.name));
  let previous = -1, rank = 0;
  return ranked.map((r, i) => { if (Math.abs(r.score - previous) > 1e-9) rank = i + 1; previous = r.score; return { ...r, rank }; });
}
export function elapsedSeconds(run: { startedAt: string; stoppedAt: string | null }, now = Date.now()): number {
  return Math.max(0, Math.floor(((run.stoppedAt ? Date.parse(run.stoppedAt) : now) - Date.parse(run.startedAt)) / 1000));
}
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
}
