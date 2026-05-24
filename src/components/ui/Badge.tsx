import type { CSSProperties, ReactNode } from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'draft';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const styles: Record<BadgeVariant, CSSProperties> = {
    success: { background: 'var(--color-success-light)', color: '#065f46' },
    warning: { background: 'var(--color-warning-light)', color: '#92400e' },
    error: { background: 'var(--color-error-light)', color: '#991b1b' },
    info: { background: 'var(--color-info-light)', color: '#1e40af' },
    neutral: { background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' },
    draft: {
      background: 'var(--color-surface-tertiary)',
      color: 'var(--color-text-tertiary)',
      border: '1px dashed var(--color-border)',
    },
  };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={styles[variant]}
    >
      {children}
    </span>
  );
}
