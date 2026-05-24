import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface SnapshotEntry {
  date: string; // YYYY-MM-DD
  stars: number;
  forks: number;
  openIssues: number;
}

const DATA_DIR = join(homedir(), '.gh-dashboard');
const SNAPSHOTS_FILE = join(DATA_DIR, 'snapshots.json');

async function ensureDir() {
  try {
    await access(DATA_DIR);
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readSnapshots(): Promise<Record<string, SnapshotEntry[]>> {
  await ensureDir();
  try {
    const raw = await readFile(SNAPSHOTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeSnapshots(data: Record<string, SnapshotEntry[]>) {
  await ensureDir();
  await writeFile(SNAPSHOTS_FILE, JSON.stringify(data, null, 2));
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Record a snapshot for a single repo. Overwrites any existing entry for today.
 */
export async function recordSnapshot(
  repoFullName: string,
  stars: number,
  forks: number,
  openIssues: number,
): Promise<void> {
  const snapshots = await readSnapshots();
  const entry: SnapshotEntry = { date: today(), stars, forks, openIssues };

  const list = snapshots[repoFullName] || [];
  // Replace today's entry if it exists
  const idx = list.findIndex((e) => e.date === entry.date);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  // Keep last 90 days only
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  snapshots[repoFullName] = list.filter((e) => e.date >= cutoffStr);

  await writeSnapshots(snapshots);
}

/**
 * Record snapshots for multiple repos in one call.
 */
export async function recordSnapshots(
  repos: { full_name: string; stargazers_count: number; forks_count: number; open_issues_count: number }[],
): Promise<void> {
  for (const repo of repos) {
    await recordSnapshot(
      repo.full_name,
      repo.stargazers_count || 0,
      repo.forks_count || 0,
      repo.open_issues_count || 0,
    );
  }
}

/**
 * Get all stored snapshots.
 */
export async function getSnapshots(): Promise<Record<string, SnapshotEntry[]>> {
  return readSnapshots();
}

/**
 * Get snapshot history for a specific repo.
 */
export async function getRepoSnapshots(repoFullName: string): Promise<SnapshotEntry[]> {
  const snapshots = await readSnapshots();
  return snapshots[repoFullName] || [];
}
