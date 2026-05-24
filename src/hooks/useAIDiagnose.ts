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
      const raw = localStorage.getItem('aiAgent');
      const ALLOWED_AGENTS = [
        'opencode', 'claude-code', 'claude', 'cursor', 'codex', 'copilot', 'auto',
      ];
      const preferred = raw && ALLOWED_AGENTS.includes(raw) ? raw : 'auto';

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
