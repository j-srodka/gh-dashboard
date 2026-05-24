import { useState } from 'react';
import { useDigest, useSnapshots } from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { buildDigestMarkdown, copyToClipboard } from '@/lib/digests';
import { TrendingUp, TrendingDown, Minus, Calendar, Copy, Check, Star, GitFork, CircleDot, Newspaper, Database } from 'lucide-react';

type Period = 'daily' | 'weekly';

interface BaselineEntry {
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
}

export function DigestPage() {
  const [period, setPeriod] = useLocalStorage<Period>('digestPeriod', 'daily');
  const { data, isLoading, isError } = useDigest(period);
  const { data: snapshots } = useSnapshots();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!data) return;
    const md = buildDigestMarkdown(data);
    await copyToClipboard(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Build baseline from latest snapshots when no history exists
  const baseline = (() => {
    if (!snapshots) return [] as BaselineEntry[];
    const entries: BaselineEntry[] = [];
    for (const [repo, history] of Object.entries(snapshots)) {
      if (history.length === 0) continue;
      const latest = history[history.length - 1];
      entries.push({ repo, stars: latest.stars, forks: latest.forks, openIssues: latest.openIssues });
    }
    return entries;
  })();

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Digest</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Period-over-period repository changes</p>
        </div>
        <div className="rounded-xl border p-8 animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Newspaper className="w-8 h-8 mx-auto mb-3 text-red-500" />
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Failed to load digest</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Could not compute period changes.</p>
      </div>
    );
  }

  const digest = data!;
  const totalStarDelta = digest.entries.reduce((sum, e) => sum + e.stars, 0);
  const totalForkDelta = digest.entries.reduce((sum, e) => sum + e.forks, 0);
  const totalIssueDelta = digest.entries.reduce((sum, e) => sum + e.openIssues, 0);
  const hasHistory = digest.entries.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Digest</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Period-over-period repository changes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!digest || digest.entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300 disabled:opacity-50"
            style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy as Markdown'}</span>
          </button>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg border w-fit" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => setPeriod('daily')}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            background: period === 'daily' ? 'var(--color-brand)' : 'transparent',
            color: period === 'daily' ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          Daily
        </button>
        <button
          onClick={() => setPeriod('weekly')}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            background: period === 'weekly' ? 'var(--color-brand)' : 'transparent',
            color: period === 'weekly' ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          Weekly
        </button>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Calendar className="w-3.5 h-3.5" />
        <span>{digest.from}</span>
        <span>→</span>
        <span>{digest.to}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {hasHistory ? (
          <>
            <SummaryCard icon={Star} label="Stars" value={totalStarDelta} />
            <SummaryCard icon={GitFork} label="Forks" value={totalForkDelta} />
            <SummaryCard icon={CircleDot} label="Open Issues" value={totalIssueDelta} />
          </>
        ) : (
          <>
            <BaselineCard icon={Star} label="Stars" value={baseline.reduce((s, e) => s + e.stars, 0)} />
            <BaselineCard icon={GitFork} label="Forks" value={baseline.reduce((s, e) => s + e.forks, 0)} />
            <BaselineCard icon={CircleDot} label="Open Issues" value={baseline.reduce((s, e) => s + e.openIssues, 0)} />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-secondary)' }}>
                <th className="px-4 py-3 font-medium text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Repository</th>
                <th className="px-4 py-3 font-medium text-xs text-right" style={{ color: 'var(--color-text-tertiary)' }}>Stars</th>
                <th className="px-4 py-3 font-medium text-xs text-right" style={{ color: 'var(--color-text-tertiary)' }}>Forks</th>
                <th className="px-4 py-3 font-medium text-xs text-right" style={{ color: 'var(--color-text-tertiary)' }}>Open Issues</th>
              </tr>
            </thead>
            <tbody>
              {hasHistory && digest.entries.map((entry) => (
                <tr key={entry.repo} className="border-b last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{entry.repo}</td>
                  <td className="px-4 py-3 text-right">
                    <Delta value={entry.stars} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Delta value={entry.forks} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Delta value={entry.openIssues} />
                  </td>
                </tr>
              ))}
              {!hasHistory && baseline.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>No data yet</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      Visit this page over multiple days to build a history of changes.
                    </p>
                  </td>
                </tr>
              )}
              {!hasHistory && baseline.length > 0 && (
                <>
                  {baseline.map((entry) => (
                    <tr key={entry.repo} className="border-b last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{entry.repo}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{entry.stars}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{entry.forks}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{entry.openIssues}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-center">
                      <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        <Database className="w-3 h-3" />
                        Showing current snapshot values. Deltas will appear after multiple days of data.
                      </p>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  const isPositive = value > 0;
  const isZero = value === 0;

  return (
    <div
      className="rounded-xl border p-5 flex items-center gap-4"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: isZero ? 'var(--color-surface-tertiary)' : isPositive ? 'var(--color-success-light)' : 'var(--color-error-light)',
        }}
      >
        <Icon className="w-5 h-5" style={{ color: isZero ? 'var(--color-text-tertiary)' : isPositive ? 'var(--color-success)' : 'var(--color-error)' }} />
      </div>
      <div>
        <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
        <div className="text-xl font-bold tabular-nums flex items-center gap-1" style={{ color: isZero ? 'var(--color-text-primary)' : isPositive ? 'var(--color-success)' : 'var(--color-error)' }}>
          {isZero ? (
            <Minus className="w-4 h-4" />
          ) : isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          {isZero ? '0' : `${value > 0 ? '+' : ''}${Math.abs(value)}`}
        </div>
      </div>
    </div>
  );
}

function BaselineCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div
      className="rounded-xl border p-5 flex items-center gap-4"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface-tertiary)' }}
      >
        <Icon className="w-5 h-5" style={{ color: 'var(--color-text-tertiary)' }} />
      </div>
      <div>
        <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
        <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
  }
  const isPositive = value > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums px-2 py-0.5 rounded-full"
      style={{
        color: isPositive ? 'var(--color-success)' : 'var(--color-error)',
        background: isPositive ? 'var(--color-success-light)' : 'var(--color-error-light)',
      }}
    >
      {isPositive ? '+' : ''}{Math.abs(value)}
    </span>
  );
}
