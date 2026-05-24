import { getSnapshots, type SnapshotEntry } from './snapshots.js';

export interface DigestEntry {
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
}

export interface DigestResult {
  period: 'daily' | 'weekly';
  from: string;
  to: string;
  entries: DigestEntry[];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function previousDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function previousWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function findSnapshot(entries: SnapshotEntry[], date: string): SnapshotEntry | undefined {
  return entries.find((e) => e.date === date);
}

function computeDelta(current: SnapshotEntry, previous: SnapshotEntry): DigestEntry {
  return {
    repo: '', // filled by caller
    stars: current.stars - previous.stars,
    forks: current.forks - previous.forks,
    openIssues: current.openIssues - previous.openIssues,
  };
}

export async function computeDigest(period: 'daily' | 'weekly'): Promise<DigestResult> {
  const snapshots = await getSnapshots();
  const to = today();
  const from = period === 'daily' ? previousDay(to) : previousWeek(to);

  const entries: DigestEntry[] = [];

  for (const [repo, history] of Object.entries(snapshots)) {
    const current = findSnapshot(history, to);
    const previous = findSnapshot(history, from);
    if (current && previous) {
      const delta = computeDelta(current, previous);
      delta.repo = repo;
      entries.push(delta);
    }
  }

  // Sort by absolute star change descending
  entries.sort((a, b) => Math.abs(b.stars) - Math.abs(a.stars));

  return { period, from, to, entries };
}
