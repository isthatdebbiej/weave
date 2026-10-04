import type { Dimension } from './types';
export const dimensions: Record<Dimension, { label: string; short: string; color: string; tint: string; description: string }> = {
  product: { label: 'Product outcomes', short: 'Product', color: '#9e6426', tint: '#fff2dc', description: 'Useful capabilities and documented user problems addressed.' },
  reliability: { label: 'Reliability', short: 'Reliability', color: '#426e68', tint: '#e6f3ed', description: 'Failures corrected and recurrence guarded against.' },
  performance: { label: 'Performance', short: 'Performance', color: '#536aac', tint: '#edf1ff', description: 'Measured improvements with units and workload context.' },
  devex: { label: 'Developer experience', short: 'DevEx', color: '#956076', tint: '#faedf2', description: 'Development obstacles removed and workflows improved.' },
  leverage: { label: 'Engineering leverage', short: 'Leverage', color: '#7b62a4', tint: '#f0eafa', description: 'Shared foundations explicitly adopted by later work.' },
  simplification: { label: 'Simplification', short: 'Simplification', color: '#667943', tint: '#f0f3df', description: 'Redundant paths consolidated while preserving required behavior.' },
};
