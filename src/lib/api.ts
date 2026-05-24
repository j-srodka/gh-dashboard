const BASE = '/api/github';

// Module-level account ID — set by AccountProvider
let _activeAccountId: string | undefined;

export function setActiveAccount(id: string | undefined) {
  _activeAccountId = id;
}

export function getActiveAccount(): string | undefined {
  return _activeAccountId;
}

async function githubRequest<T>(method: string, path: string, body?: unknown, accountId?: string): Promise<T> {
  const url = `${BASE}/${path.replace(/^\/+/, '')}`;
  const acc = accountId || _activeAccountId;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (acc) {
    headers['X-Account'] = acc;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function githubGet<T>(path: string): Promise<T> {
  return githubRequest<T>('GET', path);
}

/** Like githubGet but returns the raw Response so callers can inspect headers (e.g. x-poll-interval). */
export async function githubGetResponse(path: string): Promise<Response> {
  const url = `${BASE}/${path.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (_activeAccountId) {
    headers['X-Account'] = _activeAccountId;
  }

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok && response.status !== 404 && response.status !== 204) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }

  return response;
}

export function githubPost<T>(path: string, body?: unknown): Promise<T> {
  return githubRequest<T>('POST', path, body);
}

export function githubPatch<T>(path: string, body?: unknown): Promise<T> {
  return githubRequest<T>('PATCH', path, body);
}

export function githubPut<T>(path: string, body?: unknown): Promise<T> {
  return githubRequest<T>('PUT', path, body);
}

export function githubDelete<T>(path: string): Promise<T> {
  return githubRequest<T>('DELETE', path);
}

// GitHub GraphQL API proxy
export async function githubGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_activeAccountId) {
    headers['X-Account'] = _activeAccountId;
  }

  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL API ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.errors?.length > 0) {
    throw new Error(data.errors[0].message);
  }

  return data.data as T;
}
