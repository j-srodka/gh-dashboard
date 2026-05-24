import { useMutation } from '@tanstack/react-query';

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

export function useAIDiagnose() {
  return useMutation({
    mutationFn: async (req: DiagnoseRequest): Promise<DiagnoseResult> => {
      // Read preferred agent from localStorage with validation
      const ALLOWED_AGENTS = [
        'opencode', 'claude-code', 'claude', 'cursor', 'codex', 'copilot', 'auto',
      ];
      let preferred = 'auto';
      try {
        const raw = localStorage.getItem('aiAgent');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (ALLOWED_AGENTS.includes(parsed)) {
            preferred = parsed;
          }
        }
      } catch {
        const raw = localStorage.getItem('aiAgent');
        if (raw && ALLOWED_AGENTS.includes(raw)) {
          preferred = raw;
        }
      }

      const body: DiagnoseRequest = {
        ...req,
        agentCli: req.agentCli || (preferred === 'auto' ? undefined : preferred) || undefined,
      };

      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Diagnose API ${res.status}: ${text}`);
      }
      return res.json();
    },
  });
}
