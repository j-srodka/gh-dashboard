import { useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useRepos, useUser } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useAccount } from '@/contexts/AccountContext';
import { LANGUAGE_COLORS } from '@/lib/constants';
import { Monitor, Sun, Moon, Users, Bell, BellOff, AlertCircle } from 'lucide-react';

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// Agent CLI options for AI Troubleshooting
const AGENT_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', desc: 'Use first available agent CLI' },
  { value: 'opencode', label: 'OpenCode', desc: 'npm install -g @opencode-ai/cli' },
  { value: 'claude-code', label: 'Claude Code', desc: 'npm install -g @anthropic-ai/claude-code' },
  { value: 'cursor', label: 'Cursor Agent', desc: 'cursor agent' },
  { value: 'codex', label: 'Codex', desc: 'npm install -g @openai/codex' },
  { value: 'copilot', label: 'GitHub Copilot', desc: 'gh extension install github/gh-copilot' },
];

function Toggle({ checked, onChange, ariaLabel }: { checked: boolean; onChange: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onChange}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? 'var(--color-brand)' : 'var(--color-border)' }}
      aria-label={ariaLabel}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(1.25rem)' : '' }}
      />
    </button>
  );
}

function ThemeOption({ mode, current, onClick, icon, label }: { mode: 'light' | 'dark' | 'system'; current: string; onClick: (m: 'light' | 'dark' | 'system') => void; icon: React.ReactNode; label: string }) {
  const isActive = current === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      className={`flex flex-col items-center gap-2 px-5 py-4 rounded-xl border-2 transition-all ${isActive ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
      style={{ background: isActive ? undefined : 'var(--color-surface-tertiary)' }}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'text-blue-600' : ''}`} style={{ color: isActive ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}>
        {icon}
      </div>
      <span className="text-xs font-medium" style={{ color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)' }}>{label}</span>
    </button>
  );
}

export function SettingsPage() {
  const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark' | 'system'>('themeMode', 'system');
  const [collapsed, setCollapsed] = useLocalStorage<boolean>('sidebarCollapsed', false);
  const [prReminders, setPrReminders] = useLocalStorage<boolean>('prReminders', true);
  const [ciFailures, setCiFailures] = useLocalStorage<boolean>('ciFailures', true);
  const [dailyDigest, setDailyDigest] = useLocalStorage<boolean>('dailyDigest', false);
  const [notifyCiFailures, setNotifyCiFailures] = useLocalStorage<boolean>('notifyCiFailures', true);
  const [notifyReviewRequests, setNotifyReviewRequests] = useLocalStorage<boolean>('notifyReviewRequests', true);
  const [notifyMentions, setNotifyMentions] = useLocalStorage<boolean>('notifyMentions', true);
  const [aiAgent, setAiAgent] = useLocalStorage<string>('aiAgent', 'auto');
  const { accounts, activeAccount, setActiveAccount } = useAccount();

  // Permission state for desktop notifications
  const [permState, setPermState] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermState(result);
  }, []);

  const { data: repoData, isLoading } = useRepos();
  const { data: userData } = useUser();
  const { toggleRepo, isMonitored } = useMonitoredRepos();

  const allRepos = (repoData || []).map((r: any) => ({
    name: r.name,
    fullName: r.full_name,
    desc: r.description || 'No description',
    language: r.language || 'Unknown',
  }));

  const userName = userData?.name || userData?.login || 'User';
  const userEmail = userData?.email || '';
  const userAvatar = userData?.avatar_url;
  const userInitials = userName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Configure your portal preferences</p>
      </div>

      <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4 text-lg" style={{ color: 'var(--color-text-primary)' }}>Appearance</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <ThemeOption mode="light" current={themeMode} onClick={setThemeMode} icon={<Sun className="w-5 h-5" />} label="Light" />
          <ThemeOption mode="dark" current={themeMode} onClick={setThemeMode} icon={<Moon className="w-5 h-5" />} label="Dark" />
          <ThemeOption mode="system" current={themeMode} onClick={setThemeMode} icon={<Monitor className="w-5 h-5" />} label="System" />
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Compact Sidebar</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Collapse sidebar to icon-only mode</div>
          </div>
          <Toggle checked={collapsed} onChange={() => setCollapsed(!collapsed)} ariaLabel="Toggle compact sidebar" />
        </div>
      </div>

      {accounts.length > 1 && (
        <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-lg" style={{ color: 'var(--color-text-primary)' }}>
            <Users className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            Account
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Select which GitHub account to use for API requests</p>
          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setActiveAccount(account.id)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all"
                style={{
                  background: activeAccount?.id === account.id ? 'var(--color-info-light)' : 'var(--color-surface-secondary)',
                  border: activeAccount?.id === account.id ? '1px solid var(--color-brand)' : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-mid))' }}
                  >
                    {account.label?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{account.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{account.host}</div>
                  </div>
                </div>
                {activeAccount?.id === account.id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-brand)', color: '#fff' }}>
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>AI Agent</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Choose which agent CLI to use for AI troubleshooting</p>
        <div className="space-y-2">
          {AGENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAiAgent(opt.value)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all"
              style={{
                background: aiAgent === opt.value ? 'var(--color-info-light)' : 'var(--color-surface-secondary)',
                border: aiAgent === opt.value ? '1px solid var(--color-brand)' : '1px solid transparent',
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{opt.label}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{opt.desc}</div>
              </div>
              {aiAgent === opt.value && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-brand)', color: '#fff' }}>
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Notifications</h2>
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>PR Review Reminders</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Get notified when PRs need your review</div>
          </div>
          <Toggle checked={prReminders} onChange={() => setPrReminders(!prReminders)} ariaLabel="Toggle PR review reminders" />
        </div>
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>CI Failures</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Alert when workflows fail</div>
          </div>
          <Toggle checked={ciFailures} onChange={() => setCiFailures(!ciFailures)} ariaLabel="Toggle CI failures alert" />
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Daily Digest</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Morning summary of your repos and PRs</div>
          </div>
          <Toggle checked={dailyDigest} onChange={() => setDailyDigest(!dailyDigest)} ariaLabel="Toggle daily digest" />
        </div>
      </div>

      {/* Desktop Notifications */}
      <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Bell className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          Desktop Notifications
        </h2>

        {permState === 'unsupported' ? (
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--color-warning-light, #fef3c7)', border: '1px solid var(--color-warning, #f59e0b)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Browser Notifications Not Supported</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Your browser does not support the Notification API. Try Chrome, Firefox, or Edge.
              </div>
            </div>
          </div>
        ) : permState === 'denied' ? (
          <div className="flex items-start gap-3 p-3 rounded-lg mb-4" style={{ background: 'var(--color-warning-light, #fef3c7)', border: '1px solid var(--color-warning, #f59e0b)' }}>
            <BellOff className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Notifications Blocked</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                You have blocked notifications for this site. To re-enable, update your browser settings and allow notifications for localhost:5173.
              </div>
            </div>
          </div>
        ) : permState === 'default' ? (
          <div className="mb-4">
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              Allow desktop notifications to get real-time alerts for CI failures, review requests, and @mentions.
            </p>
            <button
              onClick={requestPermission}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              <Bell className="w-4 h-4" />
              Enable Notifications
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 rounded-lg mb-4" style={{ background: 'var(--color-success-light, #dcfce7)', border: '1px solid var(--color-success, #22c55e)' }}>
            <Bell className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-success, #22c55e)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Notifications Enabled</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                You'll receive desktop notifications for the alert types selected below.
              </div>
            </div>
          </div>
        )}

        {permState === 'granted' && (
          <>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>CI Failure Notifications</div>
                <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Show desktop alert when a workflow fails</div>
              </div>
              <Toggle checked={notifyCiFailures} onChange={() => setNotifyCiFailures(!notifyCiFailures)} ariaLabel="Toggle CI failure desktop notifications" />
            </div>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Review Request Notifications</div>
                <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Show desktop alert when a PR needs your review</div>
              </div>
              <Toggle checked={notifyReviewRequests} onChange={() => setNotifyReviewRequests(!notifyReviewRequests)} ariaLabel="Toggle review request desktop notifications" />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Mention Notifications</div>
                <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Show desktop alert when you're @mentioned</div>
              </div>
              <Toggle checked={notifyMentions} onChange={() => setNotifyMentions(!notifyMentions)} ariaLabel="Toggle mention desktop notifications" />
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Manage Repositories</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Select which repositories appear on your dashboard</p>
        <div className="space-y-2">
          {isLoading && <div className="text-sm py-2" style={{ color: 'var(--color-text-tertiary)' }}>Loading repositories...</div>}
          {allRepos.map((r: any) => (
            <div key={r.name} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--color-surface-secondary)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: LANGUAGE_COLORS[r.language] || '#94a3b8' }} />
                <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{r.name}</span>
                <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{r.desc}</span>
              </div>
              <Toggle checked={isMonitored(r.fullName)} onChange={() => toggleRepo(r.fullName)} ariaLabel={`Toggle monitoring for ${r.name}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Account</h2>
        <div className="flex items-center gap-4 py-3">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-brand), #7c3aed)' }}>{userInitials}</div>
          )}
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{userName}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{userEmail || userData?.html_url || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
