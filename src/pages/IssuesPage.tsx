import { useState } from 'react';
import { useIssues } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { LABEL_COLORS } from '@/lib/constants';
import { exportToJson } from '@/lib/utils';
import { CircleDot, CheckCircle2, ExternalLink, Download } from 'lucide-react';

type IssueFilter = 'all' | 'open' | 'closed';

export function IssuesPage() {
  const { monitoredRepos } = useMonitoredRepos();
  const { data, isLoading } = useIssues(monitoredRepos);
  const [filter, setFilter] = useState<IssueFilter>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const issues = (data || [])
    .filter((i: any) => !i.pull_request)
    .filter((i: any) => {
      if (filter === 'open' && i.state !== 'open') return false;
      if (filter === 'closed' && i.state !== 'closed') return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const handleNewIssue = () => {
    if (monitoredRepos.length === 0) {
      setToast('Please select at least one repo in Settings first.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const [owner, repo] = monitoredRepos[0].split('/');
    const url = `https://github.com/${owner}/${repo}/issues/new`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      setToast('Popup blocked. Opening in same tab...');
      setTimeout(() => { window.location.href = url; }, 1500);
    }
  };

  const handleIssueClick = (issue: any) => {
    if (!issue.html_url) return;
    const win = window.open(issue.html_url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = issue.html_url;
    }
  };

  if (isLoading) {
    return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>;
  }

  return (
    <div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-[120] px-4 py-2 rounded-lg text-sm text-white shadow-lg" style={{ background: 'var(--color-brand)' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Issues</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Track bugs and feature requests across repos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToJson(issues, 'issues.json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={handleNewIssue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-brand)' }}
          >
            <CircleDot className="w-4 h-4" /> New Issue
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
              style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'open', 'closed'] as IssueFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filter === f
                    ? 'text-white'
                    : 'hover:border-blue-300'
                }`}
                style={
                  filter === f
                    ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                    : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                }
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {issues.map((issue: any) => {
          const repoName = issue.repository_url?.split('/').pop() || 'unknown';
          const authorInitials = issue.user?.login?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'UN';
          return (
            <div
              key={issue.id}
              onClick={() => handleIssueClick(issue)}
              className="rounded-xl border p-4 flex items-center gap-4 transition-all hover:border-blue-300 cursor-pointer"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {issue.state === 'open' ? (
                <CircleDot className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{issue.title}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>{repoName}</span>
                  {issue.labels?.map((l: any) => (
                    <span key={l.name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LABEL_COLORS[l.name] || 'bg-slate-100 text-slate-600'}`}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {authorInitials}
                </div>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{issue.comments || 0} 💬</span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{new Date(issue.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
