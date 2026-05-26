import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getToken, hasToken } from '@/lib/auth';

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
  isAuthenticated: boolean;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!res.ok) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      const user = await res.json() as { login?: string; avatar_url?: string; name?: string };
      const account: Account = {
        id: 'github.com',
        label: user.login || user.name || 'GitHub',
        host: 'github.com',
        login: user.login,
        avatarUrl: user.avatar_url,
      };
      setAccounts([account]);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const activeAccount = accounts[0] || null;

  const setActiveAccountCtx = useCallback((_id: string) => {
    // Single-user app: switching accounts is not supported
  }, []);

  return (
    <AccountContext.Provider value={{ accounts, activeAccount, setActiveAccount: setActiveAccountCtx, refresh: fetchAccount, loading, isAuthenticated: hasToken() }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}