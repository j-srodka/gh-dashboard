import { useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useUser } from '@/hooks/useGitHubQuery';
import { useAccount } from '@/contexts/AccountContext';
import { Users, Bell, BellOff, AlertCircle, LogOut } from 'lucide-react';

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
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer"
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

export function SettingsPage() {
  const [notifyCiFailures, setNotifyCiFailures] = useLocalStorage<boolean>('notifyCiFailures', true);
  const [notifyReviewRequests, setNotifyReviewRequests] = useLocalStorage<boolean>('notifyReviewRequests', true);
  const [notifyMentions, setNotifyMentions] = useLocalStorage<boolean>('notifyMentions', true);
  const [aiAgent, setAiAgent] = useLocalStorage<string>('aiAgent', 'auto');
  const { accounts, activeAccount, setActiveAccount } = useAccount();
  const [toast, setToast] = useState<string | null>(null);

  // Permission state for desktop notifications
  const [permState, setPermState] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermState(result);
  }, []);

  const { data: userData } = useUser();

  const userName = userData?.name || userData?.login || 'User';
  const userEmail = userData?.email || '';
  const userAvatar = userData?.avatar_url;
  const userInitials = userName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleDisconnect = () => {
    localStorage.clear();
    setToast("Logged out of the portal. Run 'gh auth logout' in your terminal to completely disconnect GitHub CLI.");
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-[120] px-4 py-2 rounded-lg text-sm text-white shadow-lg" style={{ background: 'var(--color-brand)' }}>
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Configure your portal preferences</p>
      </div>

      {accounts.length > 1 && (
        <div className="rounded-xl border p-6 mb-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-lg" style={{ color: 'var(--color-text-primary)' }}>
            <Users className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            Active Account
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Select which GitHub account to use for API requests</p>
          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setActiveAccount(account.id)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer"
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
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Choose which agent CLI to use for AI troubleshooting and diagnostics</p>
        <div className="space-y-2">
          {AGENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAiAgent(opt.value)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer"
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
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Bell className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          Notifications & Alerts
        </h2>

        {permState === 'unsupported' ? (
          <div className="flex items-start gap-3 p-3 rounded-lg mb-4" style={{ background: 'var(--color-warning-light, #fef3c7)', border: '1px solid var(--color-warning, #f59e0b)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Browser Notifications Not Supported</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Your browser does not support desktop notifications. Inline alerts will still function.
              </div>
            </div>
          </div>
        ) : permState === 'denied' ? (
          <div className="flex items-start gap-3 p-3 rounded-lg mb-4" style={{ background: 'var(--color-warning-light, #fef3c7)', border: '1px solid var(--color-warning, #f59e0b)' }}>
            <BellOff className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Desktop Notifications Blocked</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                You have blocked notifications for this site. To re-enable, update your browser settings for localhost:5173.
              </div>
            </div>
          </div>
        ) : permState === 'default' ? (
          <div className="mb-4 p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-secondary)' }}>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              Enable desktop notifications to receive real-time alerts for CI failures, review requests, and mentions.
            </p>
            <button
              onClick={requestPermission}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 cursor-pointer"
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
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Desktop Notifications Enabled</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                You'll receive desktop browser alerts for the event types toggled below.
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>PR Review Requests</div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Get notified when PRs need your review</div>
            </div>
            <Toggle checked={notifyReviewRequests} onChange={() => setNotifyReviewRequests(!notifyReviewRequests)} ariaLabel="Toggle PR review notifications" />
          </div>
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>CI Failures</div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Alert when github action workflows fail</div>
            </div>
            <Toggle checked={notifyCiFailures} onChange={() => setNotifyCiFailures(!notifyCiFailures)} ariaLabel="Toggle CI failure alerts" />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Mention Notifications</div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Get notified when you are @mentioned on GitHub</div>
            </div>
            <Toggle checked={notifyMentions} onChange={() => setNotifyMentions(!notifyMentions)} ariaLabel="Toggle mention notifications" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Account & Disconnect</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 py-1">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-12 h-12 rounded-full object-cover border" style={{ borderColor: 'var(--color-border)' }} />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-brand), #7c3aed)' }}>{userInitials}</div>
            )}
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{userName}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{userEmail || userData?.html_url || ''}</div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{ background: 'var(--color-error)' }}
          >
            <LogOut className="w-4 h-4" /> Disconnect Account
          </button>
        </div>
      </div>
    </div>
  );
}
