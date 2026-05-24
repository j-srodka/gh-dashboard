// ── Unified Inbox Item ─────────────────────────────────────────────────────
// Every actionable item (notification, PR, issue, review request) is
// normalized into this shape so the inbox can merge, score, and sort
// across all sources.

export type Reason =
  | 'assigned'
  | 'review-requested'
  | 'changes-requested'
  | 'mentioned'
  | 'stale'
  | 'stale-critical'
  | 'many-comments'
  | 'ci-failure'
  | 'security-alert'
  | 'unread';

export type ItemSource = 'notification' | 'pr' | 'issue' | 'review-request';

export type ItemType = 'pr' | 'issue' | 'ci' | 'security' | 'other';

export type ScoreTone = 'red' | 'amber' | 'green';

export interface InboxItem {
  /** Stable dedup key, e.g. "pr:owner/repo:number" */
  id: string;
  source: ItemSource;
  title: string;
  /** Full repo name, e.g. "owner/repo" */
  repo: string;
  url: string;
  updatedAt: string;
  type: ItemType;
  unread: boolean;
  author: string;
  comments: number;
  score: number;
  reasons: Reason[];
  tone: ScoreTone;
  /** Original raw item — preserved so consumers can access any extra fields. */
  raw: Record<string, unknown>;
}

// ── Score Result ───────────────────────────────────────────────────────────

export interface ScoreResult {
  score: number; // 0-100
  reasons: Reason[];
  tone: ScoreTone;
}

// ── Scoring Input ──────────────────────────────────────────────────────────

export interface ScoringInput {
  type: ItemType;
  unread: boolean;
  assigned: boolean;
  reviewRequested: boolean;
  changesRequested: boolean;
  mentioned: boolean;
  /** Days since last update (created_at or updated_at). */
  daysSinceUpdate: number;
  commentCount: number;
  ciFailed: boolean;
  isSecurityAlert: boolean;
}

// ── Scoring Algorithm ──────────────────────────────────────────────────────
//
// Weighted heuristics produce a 0-100 attention score.
//
//   Signal              Weight   Why
//   ──────────────────  ──────   ─────────────────────────────────────────
//   assigned              25     Direct ownership — your work
//   security-alert        25     Critical, time-sensitive
//   review-requested      20     Blocking someone else's work
//   ci-failure            20     Broken build needs immediate fix
//   changes-requested     15     Your PR needs revision
//   mentioned             15     Someone is talking to you
//   stale (>7 days)       10     Lingering items decay trust
//   stale (>14 days)      +5     Extra urgency for extended neglect
//   many-comments (>5)    10     Active discussion needs resolution
//   unread                 5     You haven't acknowledged it yet
//
// Max possible raw = 25+25+20+20+15+15+15+10+5 = 150 — clamped to 100.
//
// Tone thresholds:
//   red   ≥ 60  — needs immediate attention
//   amber ≥ 30  — should review soon
//   green  < 30 — low priority

const STALE_DAYS = 7;
const STALE_CRITICAL_DAYS = 14;
const MANY_COMMENTS_THRESHOLD = 5;

export function computeAttentionScore(input: ScoringInput): ScoreResult {
  const reasons: Reason[] = [];
  let score = 0;

  // ── assigned ──
  if (input.assigned) {
    score += 25;
    reasons.push('assigned');
  }

  // ── security alert ──
  if (input.isSecurityAlert) {
    score += 25;
    reasons.push('security-alert');
  }

  // ── review requested ──
  if (input.reviewRequested) {
    score += 20;
    reasons.push('review-requested');
  }

  // ── CI failure ──
  if (input.ciFailed) {
    score += 20;
    reasons.push('ci-failure');
  }

  // ── changes requested ──
  if (input.changesRequested) {
    score += 15;
    reasons.push('changes-requested');
  }

  // ── mentioned ──
  if (input.mentioned) {
    score += 15;
    reasons.push('mentioned');
  }

  // ── stale ──
  if (input.daysSinceUpdate > STALE_CRITICAL_DAYS) {
    score += 15; // 10 + 5
    reasons.push('stale');
    reasons.push('stale-critical');
  } else if (input.daysSinceUpdate > STALE_DAYS) {
    score += 10;
    reasons.push('stale');
  }

  // ── many comments ──
  if (input.commentCount > MANY_COMMENTS_THRESHOLD) {
    score += 10;
    reasons.push('many-comments');
  }

  // ── unread ──
  if (input.unread) {
    score += 5;
    reasons.push('unread');
  }

  // Clamp to 0-100
  const clamped = Math.max(0, Math.min(100, score));

  // Determine tone
  let tone: ScoreTone;
  if (clamped >= 60) {
    tone = 'red';
  } else if (clamped >= 30) {
    tone = 'amber';
  } else {
    tone = 'green';
  }

  return { score: clamped, reasons, tone };
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/** Derive a dedup key from a GitHub repo URL and item number. */
export function dedupKey(type: ItemType, repo: string, number: number): string {
  return `${type}:${repo}:${number}`;
}

/** Extract owner/repo from a GitHub repository_url. */
export function repoFullName(repositoryUrl: string | undefined): string {
  if (!repositoryUrl) return 'unknown/unknown';
  const parts = repositoryUrl.split('/');
  if (parts.length < 2) return 'unknown/unknown';
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}
