import { useLocalStorage } from '@/hooks/useLocalStorage';

export function useMonitoredRepos() {
  const [monitoredRepos, setMonitoredRepos] = useLocalStorage<string[]>('monitoredRepos', []);

  function toggleRepo(fullName: string) {
    setMonitoredRepos((prev) => {
      if (prev.includes(fullName)) {
        return prev.filter((r) => r !== fullName);
      }
      return [...prev, fullName];
    });
  }

  function isMonitored(fullName: string) {
    return monitoredRepos.includes(fullName);
  }

  function setAll(repos: string[]) {
    setMonitoredRepos(repos);
  }

  return { monitoredRepos, toggleRepo, isMonitored, setAll };
}
