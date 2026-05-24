import { useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_CHANGE = 'local-storage-change';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
          window.dispatchEvent(
            new CustomEvent(LOCAL_STORAGE_CHANGE, { detail: { key, value: nextValue } }),
          );
        } catch {
          // localStorage may be unavailable
        }
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
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch {
          // ignore malformed JSON
        }
      }
    }
    function handleCustom(e: Event) {
      const ce = e as CustomEvent;
      if (ce.detail?.key === key) {
        setStoredValue(ce.detail.value);
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
