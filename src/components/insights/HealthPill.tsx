import { type HealthLabel, labelColor, labelBg } from '@/lib/insights';

interface HealthPillProps {
  label: HealthLabel;
  score?: number;
  size?: 'sm' | 'md';
}

export function HealthPill({ label, score, size = 'sm' }: HealthPillProps) {
  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${textSize} ${padding}`}
      style={{
        background: labelBg(label),
        color: labelColor(label),
      }}
    >
      {score !== undefined && (
        <span className="tabular-nums">{score}</span>
      )}
      <span>{label}</span>
    </span>
  );
}
