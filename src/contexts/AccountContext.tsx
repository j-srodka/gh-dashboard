import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { setActiveAccount } from '@/lib/api';

export interface Account {
  id: string;
  label: string;
  host: string;
  login?: string;
  avatarUrl?: string;
}

interface AccountContextValue {
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = 'activeAccount';

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'github.com';
    } catch {
      return 'github.com';
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      // Fallback: assume github.com
      setAccounts([{ id: 'github.com', label: 'Default', host: 'github.com' }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Sync active account to API layer on mount and when it changes
  useEffect(() => {
    setActiveAccount(activeId || undefined);
  }, [activeId]);

  const activeAccount = accounts.find((a) => a.id === activeId) || accounts[0] || null;

  const setActiveAccountCtx = useCallback((id: string) => {
    setActiveIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  return (
    <AccountContext.Provider value={{ accounts, activeAccount, setActiveAccount: setActiveAccountCtx, refresh: fetchAccounts, loading }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
