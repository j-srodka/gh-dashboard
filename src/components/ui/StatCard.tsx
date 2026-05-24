import type { ElementType } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
  trendColor: string;
  description?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  trendColor,
  description,
}: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg relative group"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Tooltip */}
      {description && (
        <div
          className="absolute z-50 bottom-[85%] left-4 right-4 p-3 rounded-lg border shadow-xl opacity-0 scale-95 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'var(--color-border)',
            color: 'rgb(241, 245, 249)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <p className="text-[10px] leading-relaxed font-normal">{description}</p>
        </div>
      )}

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
