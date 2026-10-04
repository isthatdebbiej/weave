import Dashboard from '@/components/dashboard';
import impact from '../../data/impact.json';
import run from '../../data/run.json';
import type { ImpactData } from '@/lib/types';

export default function Page() { return <Dashboard data={impact as ImpactData} run={run} />; }
