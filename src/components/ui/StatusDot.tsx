export type StatusDotStatus = 'success' | 'warning' | 'error' | 'pending' | 'failure';

interface StatusDotProps {
  status: StatusDotStatus;
}

export function StatusDot({ status }: StatusDotProps) {
  const colors: Record<StatusDotStatus, string> = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    pending: 'var(--color-text-tertiary)',
    failure: 'var(--color-error)',
  };

  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[status] }}
    />
  );
}
