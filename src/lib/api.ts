import { getToken } from './auth';

const BASE = 'https://api.github.com';

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function githubRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE}/${path.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    ...authHeaders(),
    'Content-Type': 'application/json',
  };

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

export async function githubGetResponse(path: string): Promise<Response> {
  const url = `${BASE}/${path.replace(/^\/+/, '')}`;
  const headers = authHeaders();

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

export async function githubGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (data.errors && data.errors.length > 0) {
    throw new Error(`GraphQL: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.data as T;
}

