import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useRepos, useNotifications } from '@/hooks/useGitHubQuery';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import {
  LayoutDashboard,
  FolderGit2,
  GitPullRequest,
  PlayCircle,
  CircleDot,
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  Bell,
  BellRing,
  ChevronDown,
  Menu,
  Search,
  GitCommit,
  AlertTriangle,
  MessageSquare,
  GitMerge,
  PanelLeft,
  Filter,
  BarChart3,
  Newspaper,
  Monitor,
  Kanban,
  Activity,
  Eye,
  Minimize2,
} from 'lucide-react';

const NAV_SECTIONS: { title: string; items: { path: string; label: string; icon: React.ElementType }[] }[] = [
  {
    title: 'Navigation',
    items: [
      { path: '/', label: 'Overview', icon: LayoutDashboard },
      { path: '/repositories', label: 'Repositories', icon: FolderGit2 },
      { path: '/insights', label: 'Insights', icon: BarChart3 },
      { path: '/digest', label: 'Digest', icon: Newspaper },
      { path: '/pull-requests', label: 'Pull Requests', icon: GitPullRequest },
      { path: '/review-queue', label: 'Review Queue', icon: Eye },
      { path: '/actions', label: 'Actions', icon: PlayCircle },
      { path: '/ci-health', label: 'CI Health', icon: Activity },
      { path: '/issues', label: 'Issues', icon: CircleDot },
      { path: '/notifications', label: 'Notifications', icon: BellRing },
      { path: '/security', label: 'Security', icon: ShieldCheck },
      { path: '/kanban', label: 'Kanban', icon: Kanban },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const PAGE_NAMES: Record<string, string> = {
  '/': 'Overview',
  '/repositories': 'Repositories',
  '/insights': 'Insights',
  '/digest': 'Digest',
  '/pull-requests': 'Pull Requests',
  '/actions': 'Actions',
  '/review-queue': 'Review Queue',
  '/ci-health': 'CI Health',
  '/issues': 'Issues',
  '/settings': 'Settings',
  '/security': 'Security',
  '/kanban': 'Kanban',
};

function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    PullRequest: { icon: GitCommit, color: 'var(--color-brand)' },
    Issue: { icon: CircleDot, color: 'var(--color-warning)' },
    Discussion: { icon: MessageSquare, color: 'var(--color-info)' },
    Commit: { icon: GitCommit, color: 'var(--color-brand)' },
    Release: { icon: GitMerge, color: 'var(--color-success)' },
    CheckSuite: { icon: AlertTriangle, color: 'var(--color-error)' },
  };
  const { icon: Icon, color } = map[type] || { icon: MessageSquare, color: 'var(--color-text-tertiary)' };
  return <Icon className="w-4 h-4" style={{ color }} />;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useLocalStorage<boolean>('sidebarCollapsed', false);
  const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark' | 'system'>('themeMode', 'system');
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('density', 'comfortable');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repoFilterOpen, setRepoFilterOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const repoFilterRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useNotifications();
  const notificationList = (notifications || []).slice(0, 10);
  const unreadCount = notificationList.filter((n: any) => n.unread).length;

  const { data: repoData } = useRepos();
  const allRepos = (repoData || []).map((r: any) => r.full_name).sort();
  const { monitoredRepos, toggleRepo, setAll } = useMonitoredRepos();

  const repoFilterLabel = monitoredRepos.length === 0
    ? 'All Repos'
    : monitoredRepos.length === 1
      ? monitoredRepos[0].split('/').pop()
      : `${monitoredRepos.length} repos`;

  // 3-mode theme: resolve system preference, apply .dark class
  useEffect(() => {
    function applyTheme() {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
    }
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [themeMode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (repoFilterRef.current && !repoFilterRef.current.contains(e.target as Node)) {
        setRepoFilterOpen(false);
      }
    }
    if (notificationsOpen || repoFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen, repoFilterOpen]);

  const toggleHelp = useCallback(() => setHelpOpen((prev) => !prev), []);

  // Global keyboard shortcuts (g+letter navigation, ?, j/k list navigation)
  useKeyboardShortcuts({
    onToggleHelp: toggleHelp,
    enabled: !commandOpen,
  });

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotificationsOpen(false);
        setCommandOpen(false);
        setMobileMenuOpen(false);
        setHelpOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const pageTitle = PAGE_NAMES[location.pathname] || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-surface-secondary)', color: 'var(--color-text-primary)' }}>
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-brand">
                <GitMerge className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm text-gradient">GitHub Portal</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'nav-active-gradient' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`
                      }
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                      }) as any}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => {
              const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';
              setThemeMode(next);
            }}
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Toggle theme: Light / Dark / System"
          >
            {themeMode === 'light' ? <Sun className="w-4 h-4 flex-shrink-0" /> : themeMode === 'dark' ? <Moon className="w-4 h-4 flex-shrink-0" /> : <Monitor className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && (
              <span>{themeMode === 'light' ? 'Light Mode' : themeMode === 'dark' ? 'Dark Mode' : 'System Auto'}</span>
            )}
          </button>
          <button
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
            style={{ color: 'var(--color-text-secondary)' }}
            title={`Density: ${density === 'comfortable' ? 'Comfortable' : 'Compact'}`}
          >
            <Minimize2 className={`w-4 h-4 flex-shrink-0 ${density === 'compact' ? 'rotate-180' : ''} transition-transform`} />
            {!collapsed && (
              <span>{density === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b shrink-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md md:hidden transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Repo filter */}
            <div className="relative" ref={repoFilterRef}>
              <button
                onClick={() => setRepoFilterOpen(!repoFilterOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
                style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">{repoFilterLabel}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {repoFilterOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border shadow-lg z-50 overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Filter Repos</span>
                    <button
                      onClick={() => setAll([])}
                      className="text-[10px] font-medium transition-colors hover:text-blue-600"
                      style={{ color: 'var(--color-brand)' }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                    {allRepos.map((repo: string) => (
                      <button
                        key={repo}
                        onClick={() => toggleRepo(repo)}
                        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <span className="truncate">{repo}</span>
                        {monitoredRepos.includes(repo) && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-brand)' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Command palette */}
            <button
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
              style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}>⌘K</kbd>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--color-error)' }} />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border shadow-lg z-50 overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notifications</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-brand-light)', color: '#fff' }}>{unreadCount} unread</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notificationList.length === 0 && (
                      <div className="text-sm py-6 text-center" style={{ color: 'var(--color-text-tertiary)' }}>No notifications</div>
                    )}
                    {notificationList.map((n: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 border-b transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="mt-0.5 shrink-0">
                          <NotificationIcon type={n.subject?.type || 'unknown'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{n.subject?.title || 'Notification'}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            <span>{n.repository?.full_name?.split('/').pop() || 'unknown'}</span>
                            <span>·</span>
                            <span>{n.unread ? 'Unread' : 'Read'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {commandOpen && (
          <CommandPalette
            open={commandOpen}
            onClose={() => setCommandOpen(false)}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
          />
        )}

        {helpOpen && (
          <KeyboardShortcutsHelp
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
          />
        )}

        <main
          className={`flex-1 overflow-y-auto p-6 ${density === 'compact' ? 'density-compact' : ''}`}
          style={{ background: 'var(--color-surface-secondary)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}


