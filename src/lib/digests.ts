export interface DigestEntry {
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
}

export interface DigestData {
  period: 'daily' | 'weekly';
  from: string;
  to: string;
  entries: DigestEntry[];
}

export function buildDigestMarkdown(digest: DigestData): string {
  const title = digest.period === 'daily' ? 'Daily Digest' : 'Weekly Digest';
  const lines: string[] = [
    `# ${title}`,
    ``,
    `**Period:** ${digest.from} → ${digest.to}`,
    ``,
    `## Changes`,
    ``,
    `| Repository | Stars | Forks | Open Issues |`,
    `|------------|------:|------:|------------:|`,
  ];

  for (const e of digest.entries) {
    const starStr = formatDelta(e.stars);
    const forkStr = formatDelta(e.forks);
    const issueStr = formatDelta(e.openIssues);
    lines.push(`| ${e.repo} | ${starStr} | ${forkStr} | ${issueStr} |`);
  }

  if (digest.entries.length === 0) {
    lines.push('*No tracked changes for this period.*');
  }

  lines.push('');
  return lines.join('\n');
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '—';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
