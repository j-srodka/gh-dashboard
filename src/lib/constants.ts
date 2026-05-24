import type { ElementType } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Go: '#00ADD8',
  Kotlin: '#A97BFF',
  HCL: '#844FBA',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  'C#': '#178600',
  HTML: '#e34c26',
};

export const LABEL_COLORS: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  enhancement: 'bg-blue-100 text-blue-700',
  'priority:high': 'bg-red-100 text-red-700',
  security: 'bg-amber-100 text-amber-700',
  enterprise: 'bg-blue-100 text-blue-700',
  infrastructure: 'bg-slate-100 text-slate-600',
  observability: 'bg-blue-100 text-blue-700',
  design: 'bg-blue-100 text-blue-700',
  dependencies: 'bg-slate-100 text-slate-600',
  refactor: 'bg-slate-100 text-slate-600',
  documentation: 'bg-blue-100 text-blue-700',
  'good first issue': 'bg-emerald-100 text-emerald-700',
  'help wanted': 'bg-emerald-100 text-emerald-700',
};

export const CONCL_ICONS: Record<string, { color: string; label: string; icon: ElementType }> = {
  success: { color: 'var(--color-success)', label: 'Success', icon: CheckCircle2 },
  failure: { color: 'var(--color-error)', label: 'Failed', icon: XCircle },
  in_progress: { color: 'var(--color-warning)', label: 'Pending', icon: AlertCircle },
  cancelled: { color: 'var(--color-text-tertiary)', label: 'Cancelled', icon: XCircle },
  skipped: { color: 'var(--color-text-tertiary)', label: 'Skipped', icon: AlertCircle },
};
