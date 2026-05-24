import { execSync } from 'child_process';

let cachedToken: string | null = null;

export function getGitHubToken(): string {
  if (cachedToken) return cachedToken;

  if (process.env.GH_TOKEN) {
    cachedToken = process.env.GH_TOKEN;
    return cachedToken;
  }

  try {
    cachedToken = execSync('gh auth token', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    return cachedToken;
  } catch {
    throw new Error(
      'No GitHub token found. Run "gh auth login" or set GH_TOKEN env var.'
    );
  }
}

export function clearCachedToken(): void {
  cachedToken = null;
}

export function getGitHubTokenForHost(hostname: string): string {
  if (hostname === 'github.com') return getGitHubToken();
  try {
    return execSync(`gh auth token --hostname ${hostname}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    throw new Error(`No token found for ${hostname}`);
  }
}
