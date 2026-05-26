/**
 * Browser-side authentication for GitHub API.
 *
 * Token sources (priority order):
 *   1. VITE_GH_TOKEN env var (injected at dev time from `gh auth token` via scripts/dev.sh)
 *   2. localStorage 'gh_token' (manual PAT entered in Settings)
 *
 * For OpenRouter AI features:
 *   - localStorage 'openrouter_api_key' (manual key entered in Settings)
 */

const GH_TOKEN_KEY = 'gh_token';
const OPENROUTER_KEY = 'openrouter_api_key';

/** Get the active GitHub token. Returns null if neither source has a token. */
export function getToken(): string | null {
  const envToken = import.meta.env.VITE_GH_TOKEN;
  if (envToken) return envToken;
  try {
    return localStorage.getItem(GH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Store a GitHub PAT in localStorage. */
export function setToken(token: string): void {
  try {
    localStorage.setItem(GH_TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (e.g. SSR)
  }
}

/** Remove the stored GitHub PAT. */
export function clearToken(): void {
  try {
    localStorage.removeItem(GH_TOKEN_KEY);
  } catch {
    // localStorage unavailable
  }
}

/** Check if a GitHub token is available. */
export function hasToken(): boolean {
  return getToken() !== null;
}

/** Get the OpenRouter API key for AI features. */
export function getOpenRouterKey(): string | null {
  try {
    return localStorage.getItem(OPENROUTER_KEY);
  } catch {
    return null;
  }
}

/** Store the OpenRouter API key. */
export function setOpenRouterKey(key: string): void {
  try {
    localStorage.setItem(OPENROUTER_KEY, key);
  } catch {
    // localStorage unavailable
  }
}

/** Remove the stored OpenRouter API key. */
export function clearOpenRouterKey(): void {
  try {
    localStorage.removeItem(OPENROUTER_KEY);
  } catch {
    // localStorage unavailable
  }
}