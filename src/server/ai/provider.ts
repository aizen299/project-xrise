import { getEnv } from '../env';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ProviderProfile {
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
}

const PROFILES: Record<'groq' | 'openrouter' | 'ollama', ProviderProfile> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    requiresKey: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    requiresKey: true,
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'llama3.1',
    requiresKey: false,
  },
};

export function aiConfig() {
  const env = getEnv();
  const profile = PROFILES[env.LLM_PROVIDER];

  return {
    provider: env.LLM_PROVIDER,
    baseUrl: env.LLM_BASE_URL ?? profile.baseUrl,
    model: env.LLM_MODEL ?? profile.defaultModel,
    apiKey: env.LLM_API_KEY,
    enabled: profile.requiresKey ? Boolean(env.LLM_API_KEY) : true,
  };
}

export function isAiEnabled(): boolean {
  try {
    return aiConfig().enabled;
  } catch {
    return false;
  }
}

function supportsReasoningEffort(model: string): boolean {
  return model.includes('gpt-oss');
}

export async function completeChat(
  messages: ChatMessage[],
  options: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const config = aiConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.4,
        max_tokens: options.maxTokens ?? 1200,
        ...(supportsReasoningEffort(config.model) ? { reasoning_effort: 'low' } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const reason = detail.slice(0, 300) || response.statusText;
      throw new Error(`LLM request failed (${response.status}): ${reason}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('LLM returned an empty completion');

    return content;
  } finally {
    clearTimeout(timeout);
  }
}
