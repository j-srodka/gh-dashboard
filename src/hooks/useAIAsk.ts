import { useMutation } from '@tanstack/react-query';
import { getToken, getOpenRouterKey } from '@/lib/auth';
import { githubGet } from '@/lib/api';

export interface AskResult {
  response: string;
  error?: string;
  agentUsed?: string;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

export function useAIAsk() {
  return useMutation({
    mutationFn: async (prompt: string): Promise<AskResult> => {
      const apiKey = getOpenRouterKey();
      if (!apiKey) {
        return {
          response: '',
          error: 'No OpenRouter API key configured. Add one in Settings.',
          agentUsed: 'openrouter',
        };
      }

      try {
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
        const content = data.choices?.[0]?.message?.content || '';
        return { response: content, agentUsed: 'openrouter' };
      } catch (err: any) {
        return { response: '', error: err.message, agentUsed: 'openrouter' };
      }
    },
  });
}