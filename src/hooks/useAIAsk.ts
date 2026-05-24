import { useMutation } from '@tanstack/react-query';

export interface AskResult {
  response: string;
  error?: string;
  agentUsed?: string;
}

export function useAIAsk() {
  return useMutation({
    mutationFn: async (prompt: string): Promise<AskResult> => {
      let agentCli = 'auto';
      try {
        const raw = localStorage.getItem('aiAgent');
        if (raw) {
          agentCli = JSON.parse(raw);
        }
      } catch {
        const raw = localStorage.getItem('aiAgent');
        if (raw) agentCli = raw;
      }
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, agentCli }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ask API ${res.status}: ${text}`);
      }
      return res.json();
    },
  });
}
