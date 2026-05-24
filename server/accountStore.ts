import { execSync } from 'child_process';

export interface Account {
  id: string;
  label: string;
  host: string;
  login?: string;
  avatarUrl?: string;
}

// In-memory account store. Tokens are resolved on demand via `gh auth token`.
const accounts: Account[] = [];

export function initAccounts(): void {
  // Discover GitHub accounts from gh CLI
  try {
    const raw = execSync('gh auth status --show-token 2>&1', {
      encoding: 'utf8',
      timeout: 5000,
    });

    // Parse account info from gh auth status output
    const loginMatch = raw.match(/Logged in to github\.com account (\S+)/);
    const login = loginMatch?.[1] || 'unknown';

    accounts.length = 0;
    accounts.push({
      id: 'github.com',
      label: login,
      host: 'github.com',
      login,
    });

    // Check for GitHub Enterprise accounts
    const hostnameMatches = raw.matchAll(/Logged in to (\S+) account (\S+)/g);
    for (const match of hostnameMatches) {
      const host = match[1];
      const acct = match[2];
      if (host !== 'github.com' && !accounts.find((a) => a.host === host)) {
        accounts.push({
          id: host,
          label: `${acct}@${host}`,
          host,
          login: acct,
        });
      }
    }
  } catch {
    // gh CLI not available — use fallback
    accounts.length = 0;
    accounts.push({
      id: 'github.com',
      label: 'Default',
      host: 'github.com',
    });
  }

  // Also add any extra accounts from GH_TOKEN env var
  if (process.env.GH_TOKEN && !accounts.find((a) => a.host === 'github.com')) {
    accounts.unshift({
      id: 'github.com',
      label: 'Default (GH_TOKEN)',
      host: 'github.com',
    });
  }
}

export function getAccounts(): Account[] {
  return [...accounts];
}

export function getTokenForAccount(accountId: string): string {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`Unknown account: ${accountId}`);

  if (account.host === 'github.com') {
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
    try {
      return execSync('gh auth token', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 5000,
      }).trim();
    } catch {
      throw new Error('No GitHub token found. Run "gh auth login" or set GH_TOKEN env var.');
    }
  }

  // Enterprise account
  try {
    return execSync(`gh auth token --hostname ${account.host}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    throw new Error(`No token found for ${account.host}`);
  }
}

export function getAccountLogin(accountId: string): string | undefined {
  return accounts.find((a) => a.id === accountId)?.login;
}
