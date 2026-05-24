import type { ElementType } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
  trendColor: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  trendColor,
}: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          {label}
        </span>
        <Icon className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      <div className="flex items-center gap-1 mt-1">
        {trendUp ? (
          <TrendingUp className="w-3 h-3" style={{ color: trendColor }} />
        ) : (
          <TrendingDown className="w-3 h-3" style={{ color: trendColor }} />
        )}
        <span className="text-xs font-medium" style={{ color: trendColor }}>
          {trend}
        </span>
      </div>
    </div>
  );
}
