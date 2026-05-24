import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcutsOptions {
  onToggleHelp: () => void;
  onNavigateItems?: (direction: 'next' | 'prev') => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onToggleHelp,
  onNavigateItems,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;

    let gKeyPressed = false;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when user is typing in an input
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        // Still allow Escape and ? in inputs
        if (e.key !== 'Escape' && e.key !== '?') return;
      }

      // ? to toggle help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // g + key navigation
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gKeyPressed = true;
        setTimeout(() => {
          gKeyPressed = false;
        }, 1200);
        return;
      }

      if (gKeyPressed) {
        gKeyPressed = false;
        switch (e.key) {
          case 'o':
            e.preventDefault();
            navigate('/');
            return;
          case 'p':
            e.preventDefault();
            navigate('/pull-requests');
            return;
          case 'i':
            e.preventDefault();
            navigate('/issues');
            return;
          case 'a':
            e.preventDefault();
            navigate('/actions');
            return;
          case 'r':
            e.preventDefault();
            navigate('/review-queue');
            return;
          case 'n':
            e.preventDefault();
            navigate('/notifications');
            return;
          case 's':
            e.preventDefault();
            navigate('/settings');
            return;
        }
      }

      // j/k navigation in lists
      if (onNavigateItems) {
        if (e.key === 'j' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onNavigateItems('next');
        }
        if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onNavigateItems('prev');
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onToggleHelp, onNavigateItems, enabled]);
}
