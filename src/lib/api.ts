// Thin client for the BIGUS backend (server/index.ts). Replaces Firebase.
export type SessionKind = 'patient' | 'staff';
const KEY: Record<SessionKind, string> = { patient: 'bigus_patient_token', staff: 'bigus_staff_token' };

export const tokens = {
  get(kind: SessionKind): string | null {
    try { return localStorage.getItem(KEY[kind]); } catch { return null; }
  },
  set(kind: SessionKind, token: string | null) {
    try { token ? localStorage.setItem(KEY[kind], token) : localStorage.removeItem(KEY[kind]); } catch { /* ignore */ }
  },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

type Opts = { method?: string; body?: any; as?: SessionKind };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const kind = opts.as ?? (path.startsWith('/api/admin') ? 'staff' : 'patient');
  const token = tokens.get(kind);
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 401) {
    tokens.set(kind, null);
    window.dispatchEvent(new CustomEvent('bigus:unauthorized', { detail: kind }));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || 'error');
  return data as T;
}

export async function downloadFile(path: string, filename: string) {
  const token = tokens.get('staff');
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'download-failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Re-runs `fn` every `ms` while the tab is visible (replaces Firestore's live listeners).
export function poll(fn: () => void, ms: number): () => void {
  const id = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
  const onVis = () => { if (document.visibilityState === 'visible') fn(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
}
