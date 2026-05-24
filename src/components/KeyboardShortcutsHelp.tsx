import { useEffect, useRef } from 'react';
import { X, ArrowUpDown, Command } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string; macKeys?: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'g o', description: 'Go to Overview' },
      { keys: 'g p', description: 'Go to Pull Requests' },
      { keys: 'g i', description: 'Go to Issues' },
      { keys: 'g a', description: 'Go to Actions' },
      { keys: 'g r', description: 'Go to Review Queue' },
      { keys: 'g n', description: 'Go to Notifications' },
      { keys: 'g s', description: 'Go to Settings' },
    ],
  },
  {
    title: 'Lists',
    shortcuts: [
      { keys: 'j', description: 'Next item' },
      { keys: 'k', description: 'Previous item' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: '⌘K', macKeys: 'Ctrl+K', description: 'Command palette' },
      { keys: 'Escape', description: 'Close modals / dropdowns' },
      { keys: '?', description: 'Toggle this help dialog' },
    ],
  },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{
        background: 'var(--color-surface-tertiary)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isMac = /Mac/i.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        ref={overlayRef}
        className="w-full max-w-md rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-surface-tertiary)' }}
            >
              <Command className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Close shortcuts help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3
                className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                  >
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {s.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {s.keys.split(' ').map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span
                              className="text-[10px]"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              then
                            </span>
                          )}
                          <KeyBadge>{key}</KeyBadge>
                        </span>
                      ))}
                      {s.macKeys && !isMac && (
                        <span className="flex items-center gap-1">
                          <span
                            className="text-[10px]"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            /
                          </span>
                          <KeyBadge>{s.macKeys}</KeyBadge>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* j/k hint */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs border"
            style={{
              background: 'var(--color-surface-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
            <span>j/k navigation works on list views (Pull Requests, Issues, etc.)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
