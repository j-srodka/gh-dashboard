import { useMutation } from '@tanstack/react-query';
import { getToken, getOpenRouterKey } from '@/lib/auth';
import { githubGet } from '@/lib/api';

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

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';
const MAX_LOG_CHARS = 16_000;

function redactSecrets(text: string): string {
  return text
    .replace(/gh[prst]_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, '[REDACTED_BEARER]')
    .replace(/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*-----END (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/(AWS|AZURE|GCP|GOOGLE)_?ACCESS_?KEY_?ID\s*[:=]\s*[A-Za-z0-9]+/gi, '[REDACTED_ACCESS_KEY]')
    .replace(/(AWS|AZURE|GCP|GOOGLE)_?SECRET_?ACCESS_?KEY\s*[:=]\s*[A-Za-z0-9/+=]+/gi, '[REDACTED_SECRET_KEY]');
}

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

export function useAIDiagnose() {
  return useMutation({
    mutationFn: async (req: DiagnoseRequest): Promise<DiagnoseResult> => {
      const apiKey = getOpenRouterKey();
      if (!apiKey) {
        return {
          diagnosis: '',
          suggestedFix: '',
          logsPreview: '',
          error: 'No OpenRouter API key configured. Add one in Settings.',
          agentUsed: 'openrouter',
        };
      }

      const { owner, repo, runId } = req;

      try {
        const token = getToken();
        if (!token) {
          return {
            diagnosis: '',
            suggestedFix: '',
            logsPreview: '',
            error: 'No GitHub token configured.',
            agentUsed: 'openrouter',
          };
        }

        const jobsUrl = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}/jobs?per_page=20`;
        const jobsData = await githubGet<{ jobs: Array<{ id: number; name: string; conclusion: string | null }> }>(jobsUrl);
        const jobs = jobsData.jobs || [];

        const failedJob = jobs.find((j) => j.conclusion === 'failure');
        const targetJob = failedJob || jobs.find((j) => j.conclusion);
        if (!targetJob) {
          return {
            diagnosis: '',
            suggestedFix: '',
            logsPreview: '',
            error: 'No completed jobs found for this workflow run.',
            agentUsed: 'openrouter',
          };
        }

        const logsRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/jobs/${encodeURIComponent(String(targetJob.id))}/logs`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!logsRes.ok) {
          return {
            diagnosis: '',
            suggestedFix: '',
            logsPreview: '',
            error: `Failed to fetch logs for job ${targetJob.id}: ${logsRes.status}`,
            agentUsed: 'openrouter',
          };
        }

        const logs = await logsRes.text();
        const logsPreview = logs.slice(0, 600).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        if (!logs.trim()) {
          return {
            diagnosis: '',
            suggestedFix: '',
            logsPreview,
            error: 'Workflow run logs are empty. The job may still be running or logs have expired.',
            agentUsed: 'openrouter',
          };
        }

        const runInfo = [
          `Repository: ${owner}/${repo}`,
          `Run ID: ${runId}`,
          `Job: ${targetJob.name}`,
        ].join('\n');

        const prompt = buildPrompt(runInfo, logs);

        const res = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'gh-dashboard',
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const output = data.choices?.[0]?.message?.content || '';

        const diagnosisMatch = output.match(/DIAGNOSIS:\s*\n?([\s\S]*?)(?=\nSUGGESTED FIX:|\n*$)/i);
        const fixMatch = output.match(/SUGGESTED FIX:\s*\n?([\s\S]*?)$/i);

        const diagnosis = diagnosisMatch?.[1]?.trim() || output.slice(0, 500);
        const suggestedFix = fixMatch?.[1]?.trim() || 'See diagnosis above.';

        return { diagnosis, suggestedFix, logsPreview, agentUsed: 'openrouter' };
      } catch (err: any) {
        return {
          diagnosis: '',
          suggestedFix: '',
          logsPreview: '',
          error: err.message || 'Unknown error',
          agentUsed: 'openrouter',
        };
      }
    },
  });
}