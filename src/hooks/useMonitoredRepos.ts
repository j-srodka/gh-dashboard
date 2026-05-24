import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export function useMonitoredRepos() {
  const [monitoredRepos, setMonitoredRepos] = useLocalStorage<string[]>('monitoredRepos', []);

  const toggleRepo = useCallback((fullName: string) => {
    setMonitoredRepos((prev) => {
      if (prev.includes(fullName)) {
        return prev.filter((r) => r !== fullName);
      }
      return [...prev, fullName];
    });
  }, [setMonitoredRepos]);

  const isMonitored = useCallback((fullName: string) => {
    return monitoredRepos.includes(fullName);
  }, [monitoredRepos]);

  const setAll = useCallback((repos: string[]) => {
    setMonitoredRepos(repos);
  }, [setMonitoredRepos]);

  return { monitoredRepos, toggleRepo, isMonitored, setAll };
}
