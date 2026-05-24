import { Activity, AlertTriangle, Lightbulb } from 'lucide-react';
import type { RepoInsight } from '@/lib/insights';
import { HealthPill } from './HealthPill';
import { LANGUAGE_COLORS } from '@/lib/constants';

interface InsightCardProps {
  repo: any;
  insight: RepoInsight;
  onClick?: () => void;
}

export function InsightCard({ repo, insight, onClick }: InsightCardProps) {
  const color = LANGUAGE_COLORS[repo.language] || '#94a3b8';

  return (
    <div
      onClick={onClick}
      className="rounded-xl border p-5 flex flex-col gap-4 card-hover cursor-pointer"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span
            className="font-semibold text-sm truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {repo.name}
          </span>
        </div>
        <HealthPill label={insight.label} score={insight.score} size="sm" />
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreBar label="Freshness" value={insight.freshnessScore} max={25} color="var(--color-brand)" />
        <ScoreBar label="Maintenance" value={insight.maintenanceScore} max={25} color="var(--color-success)" />
        <ScoreBar label="Activity" value={insight.activityScore} max={25} color="var(--color-info)" />
        <ScoreBar label="Completeness" value={insight.completenessScore} max={25} color="var(--color-warning)" />
      </div>

      {/* Alerts */}
      {insight.alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-error)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alerts</span>
          </div>
          <ul className="space-y-1">
            {insight.alerts.slice(0, 3).map((a, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--color-error)' }} />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Opportunities */}
      {insight.opportunities.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-success)' }}>
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Opportunities</span>
          </div>
          <ul className="space-y-1">
            {insight.opportunities.slice(0, 3).map((o, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--color-success)' }} />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-3 pt-3 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {insight.daysSincePush <= 1 ? 'Today' : insight.daysSincePush <= 7 ? `${insight.daysSincePush}d ago` : `${insight.daysSincePush}d`}
        </span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--color-text-secondary)' }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-tertiary)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
