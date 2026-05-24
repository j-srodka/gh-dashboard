import { useState } from 'react';
import { useProjects } from '@/hooks/useGitHubQuery';
import { useUser } from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  Kanban,
  ChevronDown,
  ExternalLink,
  CircleDot,
  GitPullRequest,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface ProjectItem {
  id: string;
  content?: {
    id?: string;
    title?: string;
    url?: string;
    number?: number;
    state?: string;
    repository?: { nameWithOwner: string };
    assignees?: { nodes: { login: string; avatarUrl: string }[] };
    labels?: { nodes: { name: string; color: string }[] };
  };
  fieldValues?: {
    nodes: {
      name?: string;
      date?: string;
      number?: number;
      field?: { name: string };
    }[];
  };
}

// Find the "Status" (or similar) single-select field value for an item
function getStatusField(item: ProjectItem): string | null {
  if (!item.fieldValues?.nodes) return null;
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === 'Status' || fv.field?.name === 'status') {
      return fv.name || null;
    }
  }
  return null;
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'shipped') return 'var(--color-success)';
  if (s === 'in progress' || s === 'in-progress' || s === 'active') return 'var(--color-brand)';
  if (s === 'todo' || s === 'backlog' || s === 'planned') return 'var(--color-text-tertiary)';
  if (s === 'blocked' || s === 'on hold') return 'var(--color-error)';
  return 'var(--color-info)';
}

function getStatusBg(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'shipped') return 'var(--color-success-light)';
  if (s === 'in progress' || s === 'in-progress' || s === 'active') return 'var(--color-info-light)';
  if (s === 'blocked' || s === 'on hold') return 'var(--color-error-light)';
  return 'var(--color-surface-tertiary)';
}

export function KanbanPage() {
  const { data: user } = useUser();
  const login = (user as any)?.login || '';
  const { data: projects, isLoading, refetch, isFetching } = useProjects(login);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [kanbanProject, setKanbanProject] = useLocalStorage<string | null>('kanbanProject', null);

  const projectList = (projects || []) as any[];
  const activeProject = projectList.find((p: any) => p.number === Number(selectedProject || kanbanProject)) || projectList[0];
  const items: ProjectItem[] = activeProject?.items?.nodes || [];

  // Group items by Status field
  const columns = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const status = getStatusField(item) || 'No Status';
    if (!columns.has(status)) columns.set(status, []);
    columns.get(status)!.push(item);
  }

  // If no status field found, show all in one column
  const displayColumns = columns.size > 0 ? columns : new Map([['Items', items]]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Kanban Board</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            GitHub Projects V2 — {activeProject?.title || 'No project selected'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {projectList.length > 0 && (
            <div className="relative">
              <select
                value={activeProject?.number || ''}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setKanbanProject(e.target.value);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {projectList.map((p: any) => (
                  <option key={p.number} value={p.number}>{p.title}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300 disabled:opacity-50"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--color-text-tertiary)' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading projects...</span>
        </div>
      )}

      {!isLoading && projectList.length === 0 && (
        <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Kanban className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>No Projects Found</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            {login ? `No GitHub Projects V2 found for @${login}` : 'Sign in to see your projects'}
          </p>
          {login && (
            <a
              href={`https://github.com/users/${login}/projects`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline"
              style={{ color: 'var(--color-brand)' }}
            >
              Create a project on GitHub →
            </a>
          )}
        </div>
      )}

      {!isLoading && activeProject && items.length === 0 && (
        <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{activeProject.title}</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>This project has no items yet</p>
        </div>
      )}

      {!isLoading && activeProject && items.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from(displayColumns.entries()).map(([status, colItems]) => (
            <KanbanColumn
              key={status}
              title={status}
              items={colItems}
              count={colItems.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ title, items, count }: { title: string; items: ProjectItem[]; count: number }) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: getStatusColor(title) }}
        />
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          {title}
        </h3>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}
        >
          {count}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <KanbanCard key={item.id} item={item} status={title} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ item, status }: { item: ProjectItem; status: string }) {
  const content = item.content;
  if (!content) {
    // Draft issue (no linked issue/PR)
    return (
      <div
        className="rounded-xl border p-4 card-hover"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-start gap-2 mb-2">
          <FileText className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {item.content?.title || 'Draft'}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
    );
  }

  const isPR = !!item.content?.url?.includes('/pull/');
  const Icon = isPR ? GitPullRequest : CircleDot;
  const iconColor = isPR ? 'var(--color-brand)' : 'var(--color-success)';

  return (
    <a
      href={content.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border p-4 flex flex-col gap-2.5 transition-all hover:border-blue-300 hover:shadow-md group"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: iconColor }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
            {content.title}
          </div>
          {content.repository?.nameWithOwner && (
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              {content.repository.nameWithOwner} #{content.number}
            </div>
          )}
        </div>
        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-tertiary)' }} />
      </div>

      {/* Labels */}
      {content.labels?.nodes && content.labels.nodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {content.labels.nodes.map((label: { name: string; color: string }) => (
            <span
              key={label.name}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `#${label.color}22`, color: `#${label.color}` }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: assignees + status badge */}
      <div className="flex items-center justify-between mt-auto pt-1">
        {content.assignees?.nodes && content.assignees.nodes.length > 0 && (
          <div className="flex -space-x-1.5">
            {content.assignees.nodes.slice(0, 3).map((a: { login: string; avatarUrl: string }) => (
              <img
                key={a.login}
                src={a.avatarUrl}
                alt={a.login}
                title={a.login}
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'var(--color-surface)' }}
              />
            ))}
          </div>
        )}
        <StatusBadge status={status} />
      </div>
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium w-fit"
      style={{ background: getStatusBg(status), color: getStatusColor(status) }}
    >
      {status}
    </span>
  );
}
