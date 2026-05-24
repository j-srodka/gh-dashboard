import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface SavedView {
  id: string;
  name: string;
  repoFilter?: string;
  statusFilter?: string;
  sortBy?: string;
  createdAt: string;
}

function generateId(): string {
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useSavedViews() {
  const [rawViews, setRawViews] = useLocalStorage<SavedView[]>('savedViews', []);

  // Ensure rawViews is always an array (handle corrupted localStorage)
  const savedViews: SavedView[] = useMemo(() => {
    if (!Array.isArray(rawViews)) return [];
    return rawViews;
  }, [rawViews]);

  const saveView = useCallback(
    (name: string, config: Omit<SavedView, 'id' | 'name' | 'createdAt'>) => {
      if (!name.trim()) return null;
      const newView: SavedView = {
        id: generateId(),
        name: name.trim(),
        ...config,
        createdAt: new Date().toISOString(),
      };
      setRawViews((prev) => {
        const next = Array.isArray(prev) ? [...prev, newView] : [newView];
        return next.slice(-20); // keep max 20 saved views
      });
      return newView;
    },
    [setRawViews],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      if (!name.trim()) return;
      setRawViews((prev) =>
        (Array.isArray(prev) ? prev.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)) : []),
      );
    },
    [setRawViews],
  );

  const deleteView = useCallback(
    (id: string) => {
      setRawViews((prev) => (Array.isArray(prev) ? prev.filter((v) => v.id !== id) : []));
    },
    [setRawViews],
  );

  const applyView = useCallback(
    (id: string): SavedView | undefined => {
      return savedViews.find((v) => v.id === id);
    },
    [savedViews],
  );

  return { savedViews, saveView, renameView, deleteView, applyView };
}
