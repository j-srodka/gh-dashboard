import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepos, useSearch } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import {
  Search,
  LayoutDashboard,
  FolderGit2,
  GitPullRequest,
  PlayCircle,
  CircleDot,
  ShieldCheck,
  Settings,
  BarChart3,
  Newspaper,
  BellRing,
  Kanban,
  Moon,
  Sun,
  Monitor,
  ExternalLink,
  PanelLeft,
  ArrowRight,
  Command,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
  section: 'pages' | 'quick' | 'repos' | 'github';
}

//

export function CommandPalette({
  open,
  onClose,
  themeMode: _themeMode,
  setThemeMode,
}: {
  open: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { monitoredRepos } = useMonitoredRepos();
  const { data: repoData } = useRepos();
  const { data: searchResults, isLoading: searchLoading } = useSearch(query, monitoredRepos);

  const allRepos = (repoData || []) as any[];

  // Build commands
  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Page navigation
      { id: 'nav-overview', label: 'Overview', icon: LayoutDashboard, action: () => { navigate('/'); onClose(); }, keywords: ['home', 'dashboard'], section: 'pages' },
      { id: 'nav-repos', label: 'Repositories', icon: FolderGit2, action: () => { navigate('/repositories'); onClose(); }, keywords: ['repos', 'code'], section: 'pages' },
      { id: 'nav-insights', label: 'Insights', icon: BarChart3, action: () => { navigate('/insights'); onClose(); }, keywords: ['health', 'scores'], section: 'pages' },
      { id: 'nav-digest', label: 'Digest', icon: Newspaper, action: () => { navigate('/digest'); onClose(); }, keywords: ['daily', 'weekly', 'summary'], section: 'pages' },
      { id: 'nav-prs', label: 'Pull Requests', icon: GitPullRequest, action: () => { navigate('/pull-requests'); onClose(); }, keywords: ['pr', 'merge', 'review'], section: 'pages' },
      { id: 'nav-actions', label: 'Actions', icon: PlayCircle, action: () => { navigate('/actions'); onClose(); }, keywords: ['ci', 'workflow', 'build'], section: 'pages' },
      { id: 'nav-issues', label: 'Issues', icon: CircleDot, action: () => { navigate('/issues'); onClose(); }, keywords: ['bugs', 'tickets'], section: 'pages' },
      { id: 'nav-notifications', label: 'Notifications', icon: BellRing, action: () => { navigate('/notifications'); onClose(); }, keywords: ['alerts', 'bell'], section: 'pages' },
      { id: 'nav-security', label: 'Security', icon: ShieldCheck, action: () => { navigate('/security'); onClose(); }, keywords: ['alerts', 'vulnerability', 'dependabot'], section: 'pages' },
      { id: 'nav-kanban', label: 'Kanban', icon: Kanban, action: () => { navigate('/kanban'); onClose(); }, keywords: ['board', 'project', 'tasks'], section: 'pages' },
      { id: 'nav-settings', label: 'Settings', icon: Settings, action: () => { navigate('/settings'); onClose(); }, keywords: ['config', 'preference'], section: 'pages' },

      // Quick actions
      { id: 'theme-light', label: 'Light Mode', icon: Sun, action: () => { setThemeMode('light'); onClose(); }, keywords: ['theme', 'light'], section: 'quick' },
      { id: 'theme-dark', label: 'Dark Mode', icon: Moon, action: () => { setThemeMode('dark'); onClose(); }, keywords: ['theme', 'dark'], section: 'quick' },
      { id: 'theme-system', label: 'System Auto', icon: Monitor, action: () => { setThemeMode('system'); onClose(); }, keywords: ['theme', 'system', 'auto'], section: 'quick' },
      { id: 'collapse-sidebar', label: 'Toggle Sidebar', icon: PanelLeft, action: () => { onClose(); }, keywords: ['sidebar', 'collapse'], section: 'quick' },

      // Repos
      ...allRepos.slice(0, 10).map((repo: any) => ({
        id: `repo-${repo.full_name}`,
        label: repo.name,
        description: repo.full_name,
        icon: FolderGit2 as React.ElementType,
        action: () => { navigate('/repositories'); onClose(); },
        keywords: [repo.name, repo.full_name, repo.language || ''],
        section: 'repos' as const,
      })),
    ];

    return items;
  }, [navigate, onClose, allRepos, setThemeMode]);

  // Github search results as command items (only when query is long enough)
  const searchCommands: CommandItem[] = useMemo(() => {
    if (query.length <= 2 || !searchResults) return [];
    return (searchResults as any[]).slice(0, 5).map((item: any) => ({
      id: `search-${item.id}`,
      label: item.title,
      description: `${item.repository_url?.split('/').pop() || 'unknown'} #${item.number}`,
      icon: item.pull_request ? GitPullRequest : CircleDot,
      action: () => {
        onClose();
        window.open(item.html_url, '_blank', 'noopener,noreferrer');
      },
      keywords: [],
      section: 'github' as const,
    }));
  }, [query, searchResults, onClose]);

  // Combined visible items
  const visibleItems = useMemo(() => {
    if (!query) {
      return commands;
    }
    const q = query.toLowerCase();
    const filtered = commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q))
    );
    // If there are GitHub search results, append them
    if (searchCommands.length > 0) {
      return [...filtered, ...searchCommands];
    }
    return filtered;
  }, [query, commands, searchCommands]);

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [visibleItems.length]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && visibleItems[selectedIndex]) {
        e.preventDefault();
        visibleItems[selectedIndex].action();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, visibleItems, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const el = items[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const sections = ['pages', 'quick', 'repos', 'github'] as const;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[560px] rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, repos, or GitHub..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}>
            <Command className="w-3 h-3" />K
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2 space-y-2">
          {visibleItems.length === 0 && query.length > 2 && (
            <div className="text-sm py-6 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              {searchLoading ? 'Searching GitHub...' : 'No results found'}
            </div>
          )}

          {sections.map((section) => {
            const items = visibleItems.filter((i) => i.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {section === 'pages' ? 'Pages' : section === 'quick' ? 'Quick Actions' : section === 'repos' ? 'Repositories' : 'GitHub Search'}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const globalIndex = visibleItems.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-command-item
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all"
                        style={{
                          background: isSelected ? 'var(--color-surface-tertiary)' : 'transparent',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--color-brand)' }} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${isSelected ? '' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                            {highlightMatch(item.label, query)}
                          </div>
                          {item.description && (
                            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                              {highlightMatch(item.description, query)}
                            </div>
                          )}
                        </div>
                        {item.section === 'github' && (
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                        )}
                        {item.section === 'pages' && (
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-text-tertiary)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--color-surface-tertiary)' }}>↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--color-surface-tertiary)' }}>↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--color-surface-tertiary)' }}>Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: 'var(--color-brand)' }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}
