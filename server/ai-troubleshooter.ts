import { execSync, spawnSync } from 'child_process';
import { getGitHubToken } from './auth.js';

const BASE = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gh-dashboard/0.1.0',
};

const MAX_LOG_CHARS = 16_000;
const DIAGNOSE_TIMEOUT_MS = 90_000;

// Known agent CLIs and their invocation patterns
const AGENT_CLIS: Record<string, { binary: string; args: (prompt: string) => string[] }> = {
  opencode: {
    binary: 'opencode',
    args: (prompt) => [prompt],
  },
  'claude-code': {
    binary: 'claude',
    args: (prompt) => ['-p', prompt],
  },
  claude: {
    binary: 'claude',
    args: (prompt) => ['-p', prompt],
  },
  cursor: {
    binary: 'cursor',
    args: (prompt) => ['agent', prompt],
  },
  codex: {
    binary: 'codex',
    args: (prompt) => ['exec', prompt],
  },
  copilot: {
    binary: 'gh',
    args: (prompt) => ['copilot', 'suggest', prompt],
  },
};

export interface DiagnoseRequest {
  owner: string;
  repo: string;
  runId: number;
  agentCli?: string;
}

export interface DiagnoseResult {
  diagnosis: string;
  suggestedFix: string;
  logsPreview: string;
  error?: string;
  agentUsed?: string;
}

/**
 * Fetch the raw log text for a failed job in the given workflow run.
 */
async function fetchLogs(owner: string, repo: string, runId: number, token: string): Promise<{
  logs: string;
  jobName: string;
}> {
  // 1. Fetch jobs for this run
  const jobsUrl = `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}/jobs?per_page=20`;
  const jobsRes = await fetch(jobsUrl, {
    headers: { ...HEADERS, Authorization: `Bearer ${token}` },
  });

  if (!jobsRes.ok) {
    throw new Error(`Failed to fetch jobs: ${jobsRes.status} ${jobsRes.statusText}`);
  }

  const jobsData = (await jobsRes.json()) as { jobs: any[] };
  const jobs = jobsData.jobs || [];

  // 2. Find first failed job, or fall back to first completed job
  const failedJob = jobs.find((j: any) => j.conclusion === 'failure');
  const targetJob = failedJob || jobs.find((j: any) => j.conclusion);

  if (!targetJob) {
    throw new Error('No completed jobs found for this workflow run');
  }

  // 3. Fetch raw logs for the target job
  const logsUrl = `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/jobs/${encodeURIComponent(String(targetJob.id))}/logs`;
  const logsRes = await fetch(logsUrl, {
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
      // Request raw text, not JSON
    },
  });

  if (!logsRes.ok) {
    throw new Error(`Failed to fetch logs for job ${targetJob.id}: ${logsRes.status}`);
  }

  const rawLogs = await logsRes.text();
  return { logs: rawLogs, jobName: targetJob.name };
}

/**
 * Detect available agent CLI and return its binary name,
 * or null if none found.
 */
function detectAgentCli(preferred?: string): { binary: string; name: string } | null {
  if (preferred && Object.hasOwn(AGENT_CLIS, preferred)) {
    const cli = AGENT_CLIS[preferred];
    try {
      execSync(`which ${cli.binary}`, { stdio: 'ignore', timeout: 3000 });
      return { binary: cli.binary, name: preferred };
    } catch {
      // Preferred CLI not found, fall through to auto-detect
    }
  }

  // Auto-detect
  for (const [name, cli] of Object.entries(AGENT_CLIS)) {
    try {
      execSync(`which ${cli.binary}`, { stdio: 'ignore', timeout: 3000 });
      return { binary: cli.binary, name };
    } catch {
      // Not installed
    }
  }

  return null;
}

/** Redact common secret patterns from text. */
function redactSecrets(text: string): string {
  return text
    .replace(/gh[prst]_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, '[REDACTED_BEARER]')
    .replace(/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*-----END (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/(AWS|AZURE|GCP|GOOGLE)_?ACCESS_?KEY_?ID\s*[:=]\s*[A-Za-z0-9]+/gi, '[REDACTED_ACCESS_KEY]')
    .replace(/(AWS|AZURE|GCP|GOOGLE)_?SECRET_?ACCESS_?KEY\s*[:=]\s*[A-Za-z0-9/+=]+/gi, '[REDACTED_SECRET_KEY]');
}

/**
 * Build the diagnosis prompt from workflow logs.
 */
function buildPrompt(runInfo: string, logs: string): string {
  const truncatedLogs = logs.length > MAX_LOG_CHARS
    ? logs.slice(logs.length - MAX_LOG_CHARS).replace(/^[^\n]*\n/, '[earlier log output truncated]\n')
    : logs;

  const redacted = redactSecrets(truncatedLogs);

  return `You are a CI/CD troubleshooting assistant. Analyze the following GitHub Actions workflow run logs and provide a diagnosis.

${runInfo}

--- LOGS ---
${redacted}
--- END LOGS ---

Provide your analysis in this exact format:

DIAGNOSIS:
<2-3 sentences describing what went wrong, including the root cause>

SUGGESTED FIX:
<Specific code or configuration change to resolve the issue. Include file paths and line references when possible.>`;
}

/**
 * Diagnose a failed workflow run by fetching its logs and analyzing
 * them with the user's preferred agent CLI.
 */
export async function diagnoseWorkflowFailure(
  req: DiagnoseRequest
): Promise<DiagnoseResult> {
  const { owner, repo, runId, agentCli } = req;

  // 1. Authenticate
  const token = getGitHubToken();

  // 2. Detect or use specified agent CLI
  const agent = detectAgentCli(agentCli);
  if (!agent) {
    return {
      diagnosis: '',
      suggestedFix: '',
      logsPreview: '',
      error:
        'No AI agent CLI found on your system. Install one of: opencode, claude-code (claude), cursor, codex, or GitHub Copilot CLI.\n\n' +
        'Quick install:\n' +
        '  • OpenCode:    npm install -g @opencode-ai/cli\n' +
        '  • Claude Code: npm install -g @anthropic-ai/claude-code\n' +
        '  • Cursor:      https://cursor.com/download (native app, "cursor agent" in terminal)\n' +
        '  • Codex:       npm install -g @openai/codex\n' +
        '  • Copilot:     gh extension install github/gh-copilot',
      agentUsed: undefined,
    };
  }

  // 3. Fetch logs
  let logs: string;
  let jobName: string;

  try {
    const result = await fetchLogs(owner, repo, runId, token);
    logs = result.logs;
    jobName = result.jobName;
  } catch (err: any) {
    return {
      diagnosis: '',
      suggestedFix: '',
      logsPreview: '',
      error: `Failed to fetch workflow logs: ${err.message}`,
      agentUsed: agent.name,
    };
  }

  // 4. Build the logs preview (first ~600 chars for display)
  const logsPreview = logs.slice(0, 600).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  if (!logs.trim()) {
    return {
      diagnosis: '',
      suggestedFix: '',
      logsPreview,
      error: 'Workflow run logs are empty. The job may still be running or logs have expired.',
      agentUsed: agent.name,
    };
  }

  // 5. Build prompt
  const runInfo = [
    `Repository: ${owner}/${repo}`,
    `Run ID: ${runId}`,
    `Job: ${jobName}`,
  ].join('\n');

  const prompt = buildPrompt(runInfo, logs);

  // 6. Execute agent CLI
  try {
    if (!Object.hasOwn(AGENT_CLIS, agent.name)) {
      throw new Error(`Unknown agent CLI: ${agent.name}`);
    }
    const cliConfig = AGENT_CLIS[agent.name];
    const args = cliConfig.args(prompt);

    console.log(`[ai-troubleshooter] Running: ${cliConfig.binary} ${args[0]?.slice(0, 150)}...`);

    const result = spawnSync(cliConfig.binary, args, {
      timeout: DIAGNOSE_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024, // 50MB
      encoding: 'utf8',
      stdio: 'pipe',
      shell: false,
      env: { ...process.env, GITHUB_TOKEN: undefined, GH_TOKEN: undefined },
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const err: any = new Error(`${cliConfig.binary} exited with code ${result.status}`);
      err.stderr = result.stderr || '';
      throw err;
    }

    const stdout = result.stdout || '';

    // 7. Parse the response
    const output = stdout.trim();
    const diagnosisMatch = output.match(/DIAGNOSIS:\s*\n?([\s\S]*?)(?=\nSUGGESTED FIX:|\n*$)/i);
    const fixMatch = output.match(/SUGGESTED FIX:\s*\n?([\s\S]*?)$/i);

    const diagnosis = diagnosisMatch?.[1]?.trim() || output.slice(0, 500);
    const suggestedFix = fixMatch?.[1]?.trim() || 'See diagnosis above.';

    return {
      diagnosis,
      suggestedFix,
      logsPreview,
      agentUsed: agent.name,
    };
  } catch (err: any) {
    const rawStderr = err.stderr || '';
    const sanitizedStderr = redactSecrets(rawStderr);
    const isTimeout = err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM';
    const message = isTimeout
      ? `Agent CLI '${agent.binary}' timed out after ${DIAGNOSE_TIMEOUT_MS / 1000}s. Try again with a shorter log or a different agent.`
      : `Agent CLI '${agent.binary}' failed: ${err.message || 'Unknown error'}`;

    return {
      diagnosis: '',
      suggestedFix: '',
      logsPreview,
      error: message + (sanitizedStderr ? `\n\nStderr:\n${sanitizedStderr.slice(0, 500)}` : ''),
      agentUsed: agent.name,
    };
  }
}
