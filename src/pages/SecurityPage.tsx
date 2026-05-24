import { useSecurityAlerts } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Shield, AlertTriangle, Bug, GitBranch, ExternalLink } from 'lucide-react';

function severityColor(severity: string): string {
  const s = severity?.toLowerCase() || '';
  if (s === 'critical') return 'var(--color-error)';
  if (s === 'high') return 'var(--color-warning)';
  if (s === 'medium') return 'var(--color-info)';
  return 'var(--color-text-tertiary)';
}

function severityBg(severity: string): string {
  const s = severity?.toLowerCase() || '';
  if (s === 'critical') return 'var(--color-error-light)';
  if (s === 'high') return 'var(--color-warning-light)';
  if (s === 'medium') return 'var(--color-info-light)';
  return 'var(--color-surface-tertiary)';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function SecurityPage() {
  const { monitoredRepos } = useMonitoredRepos();
  const { data: alerts, isLoading } = useSecurityAlerts(monitoredRepos);
  const [filter, setFilter] = useLocalStorage<'all' | 'dependabot' | 'code-scanning'>('securityFilter', 'all');

  const summary = (() => {
    if (!alerts) return { total: 0, critical: 0, high: 0, repos: 0 };
    let total = 0;
    let critical = 0;
    let high = 0;
    for (const repo of alerts) {
      for (const d of repo.dependabot) {
        total++;
        const s = d.security_advisory?.severity?.toLowerCase() || '';
        if (s === 'critical') critical++;
        if (s === 'high') high++;
      }
      for (const c of repo.codeScanning) {
        total++;
        const s = c.rule?.severity?.toLowerCase() || '';
        if (s === 'critical') critical++;
        if (s === 'high') high++;
      }
    }
    return { total, critical, high, repos: alerts.length };
  })();

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Security Alerts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Loading security data...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Security Alerts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {summary.total > 0
              ? `${summary.total} alert${summary.total !== 1 ? 's' : ''} across ${summary.repos} repo${summary.repos !== 1 ? 's' : ''}`
              : 'No security alerts found'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'dependabot', 'code-scanning'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                background: filter === f ? 'var(--color-brand)' : 'var(--color-surface)',
                borderColor: filter === f ? 'var(--color-brand)' : 'var(--color-border)',
                color: filter === f ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {f === 'all' ? 'All' : f === 'dependabot' ? 'Dependabot' : 'Code Scanning'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary.total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" style={{ color: 'var(--color-error)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Critical</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-error)' }}>{summary.critical}</div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>High</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{summary.high}</div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Bug className="w-4 h-4" style={{ color: 'var(--color-info)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Total</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{summary.total}</div>
          </div>
        </div>
      )}

      {/* Alerts by repo */}
      <div className="space-y-4">
        {alerts?.map((repoAlerts) => {
          const showDependabot = filter === 'all' || filter === 'dependabot';
          const showCodeScanning = filter === 'all' || filter === 'code-scanning';
          const dAlerts = showDependabot ? repoAlerts.dependabot : [];
          const cAlerts = showCodeScanning ? repoAlerts.codeScanning : [];
          const total = dAlerts.length + cAlerts.length;

          if (total === 0 && !repoAlerts.error) return null;

          return (
            <div key={repoAlerts.repo} className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {/* Repo header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                <GitBranch className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{repoAlerts.repo}</span>
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>
                  {total} alert{total !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Dependabot alerts */}
              {dAlerts.length > 0 && (
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {dAlerts.map((alert: any, idx: number) => {
                    const severity = alert.security_advisory?.severity || 'low';
                    const pkg = alert.security_vulnerability?.package?.name || 'unknown';
                    const desc = alert.security_advisory?.summary || 'Unknown vulnerability';
                    return (
                      <a
                        key={`d-${idx}`}
                        href={alert.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-4 py-3 hover-theme"
                      >
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 mt-0.5"
                          style={{ background: severityBg(severity), color: severityColor(severity) }}
                        >
                          {severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{desc}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            <span>{pkg}</span>
                            <span>·</span>
                            <span>{formatDate(alert.created_at)}</span>
                            {daysSince(alert.created_at) > 30 && (
                              <span style={{ color: 'var(--color-error)' }}>· {daysSince(alert.created_at)}d old</span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-tertiary)' }} />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Code scanning alerts */}
              {cAlerts.length > 0 && (
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {cAlerts.map((alert: any, idx: number) => {
                    const severity = alert.rule?.severity || 'low';
                    const rule = alert.rule?.description || alert.rule?.id || 'Unknown rule';
                    const location = alert.most_recent_instance?.location?.path || 'unknown file';
                    return (
                      <a
                        key={`c-${idx}`}
                        href={alert.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-4 py-3 hover-theme"
                      >
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 mt-0.5"
                          style={{ background: severityBg(severity), color: severityColor(severity) }}
                        >
                          {severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{rule}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            <span>{location}</span>
                            <span>·</span>
                            <span>{formatDate(alert.created_at)}</span>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-tertiary)' }} />
                      </a>
                    );
                  })}
                </div>
              )}

              {repoAlerts.error && (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-warning)' }}>
                  {repoAlerts.error}
                </div>
              )}
            </div>
          );
        })}

        {alerts && alerts.every((r) => (r.dependabot.length + r.codeScanning.length) === 0) && (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No security alerts</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {alerts.some((r) => r.error)
                ? 'Some repositories could not be checked — your token may lack security scope'
                : 'Your monitored repositories have no open security alerts'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
