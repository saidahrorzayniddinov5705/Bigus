// AI requests go through our backend now (server/ai.ts) — the Gemini key is
// no longer shipped inside the public JavaScript bundle.
import { api } from './api';

export type ChatResult = { ok: true; text: string } | { ok: false; reason: 'not-configured' | 'error' };

export async function generateHealthTip(_medNames: string[], language: string): Promise<string | null> {
  try {
    const r = await api<{ tip: string | null }>('/api/ai/tip', { body: { language } });
    return r.tip;
  } catch {
    return null;
  }
}

export async function chatWithAssistant(
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  message: string,
  language: string
): Promise<ChatResult> {
  try {
    return await api<ChatResult>('/api/ai/chat', {
      body: { message, language, history: history.map(h => ({ role: h.role, text: h.parts[0]?.text || '' })) },
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
}
