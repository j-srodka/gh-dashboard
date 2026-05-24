import { useState, useEffect, useCallback, useRef } from 'react';

const LOCAL_STORAGE_CHANGE = 'local-storage-change';

/** Key shared across all useLocalStorage instances for same-key tracking. */
const broadcastVersion: Record<string, number> = {};

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Track the last *committed* value so the side-effect listener can tell
  // whether an incoming event actually changed the stored value. This avoids
  // the infinite-loop that would occur if we called setStoredValue with a
  // new-array-ref that has the same *content* as the current state.
  const committedRef = useRef<T>(storedValue);

  // Write committed state to localStorage + broadcast whenever it changes.
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      const prev = window.localStorage.getItem(key);
      if (prev === json) {
        // Content hasn't changed even if the ref is different – bail early so
        // we don't dispatch a redundant event that would loop back to us.
        committedRef.current = storedValue;
        return;
      }
      window.localStorage.setItem(key, json);
      // Use a monotonically-increasing version to let listeners distinguish
      // stale events from new ones (helps with StrictMode double-invoke).
      broadcastVersion[key] = (broadcastVersion[key] || 0) + 1;
      window.dispatchEvent(
        new CustomEvent(LOCAL_STORAGE_CHANGE, {
          detail: { key, value: storedValue, version: broadcastVersion[key] },
        }),
      );
      committedRef.current = storedValue;
    } catch {
      // localStorage may be unavailable
    }
  }, [key, storedValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        // Return the next value — the side-effect (useEffect above) handles
        // localStorage writes + event dispatching *outside* React's commit.
        return nextValue;
      });
    },
    [key],
  );

  // Sync across tabs AND within the same tab
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as T;
          // Use JSON comparison to avoid setting state with a different ref
          // for the same content (which would trigger a useless re-render).
          if (JSON.stringify(parsed) !== JSON.stringify(committedRef.current)) {
            setStoredValue(parsed);
          }
        } catch {
          // ignore malformed JSON
        }
      }
    }

    function handleCustom(e: Event) {
      const ce = e as CustomEvent<{ key: string; value: T; version?: number }>;
      if (ce.detail?.key === key) {
        // JSON-compare instead of ref-compare so we skip redundant updates.
        const detailJson = JSON.stringify(ce.detail.value);
        if (detailJson !== JSON.stringify(committedRef.current)) {
          setStoredValue(ce.detail.value);
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_STORAGE_CHANGE, handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_STORAGE_CHANGE, handleCustom);
    };
  }, [key]);

  return [storedValue, setValue];
}
