import type { UserRole } from '../types/store';

export interface ServerSessionStatus {
  authenticated: boolean;
  uid: string | null;
  role: UserRole | null;
  emailVerified: boolean;
  providers: string[];
  csrfToken?: string;
}

export interface ServerAuditLogEntry {
  id: string;
  timestamp: string;
  event: string;
  outcome: 'success' | 'denied' | 'error';
  uid: string;
  role: UserRole | 'guest';
  path: string;
  ipHash: string;
  detail?: string;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|; )${escaped}=([^;]*)`).exec(document.cookie);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function ensureServerCsrfToken(): Promise<string> {
  const existing = readCookie('complex_csrf');
  if (existing && existing.length >= 16) return existing;

  const res = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error('Falha ao inicializar proteção CSRF.');
  }
  const data = (await res.json()) as { csrfToken?: string };
  return data.csrfToken || readCookie('complex_csrf') || '';
}

export async function buildProtectedHeaders(idToken?: string | null): Promise<Record<string, string>> {
  const csrfToken = await ensureServerCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

export async function checkAuthRateLimit(
  action: 'login' | 'register' | 'password-reset' | 'resend-verification' | 'link-account',
  identifier?: string
): Promise<void> {
  const headers = await buildProtectedHeaders(null);
  const res = await fetch('/api/auth/rate-check', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ action, identifier: identifier || '' }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      err.error || 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.'
    );
  }
}

export async function syncServerSession(idToken: string): Promise<ServerSessionStatus> {
  const headers = await buildProtectedHeaders(idToken);
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    return {
      authenticated: false,
      uid: null,
      role: null,
      emailVerified: false,
      providers: [],
    };
  }
  return (await res.json()) as ServerSessionStatus;
}

export async function clearServerSession(): Promise<void> {
  try {
    const headers = await buildProtectedHeaders(null);
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
    });
  } catch {
    // Best-effort clear
  }
}

export async function reportSecurityEvent(
  event:
    | 'AUTH_LOGIN_FAILED'
    | 'AUTH_REGISTER'
    | 'AUTH_PASSWORD_RESET_REQUEST'
    | 'AUTH_PASSWORD_RESET_CONFIRMED'
    | 'AUTH_EMAIL_VERIFICATION_SENT'
    | 'AUTH_ACCOUNT_LINKED'
    | 'AUTH_PASSWORD_UPDATED',
  outcome: 'success' | 'denied' | 'error',
  idToken?: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const headers = await buildProtectedHeaders(idToken);
    await fetch('/api/auth/security-event', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({ event, outcome, detail }),
    });
  } catch {
    // Non-blocking audit log
  }
}

export async function verifyAdminServerAccess(idToken?: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/access', {
      method: 'GET',
      credentials: 'same-origin',
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authorized?: boolean; role?: string };
    return data.authorized === true && data.role === 'admin';
  } catch {
    return false;
  }
}

export async function fetchAdminAuditLogs(idToken?: string | null): Promise<ServerAuditLogEntry[]> {
  const res = await fetch('/api/admin/audit-logs', {
    method: 'GET',
    credentials: 'same-origin',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
  });
  if (!res.ok) {
    throw new Error('Acesso não autorizado aos logs de auditoria.');
  }
  const data = (await res.json()) as { events?: ServerAuditLogEntry[] };
  return Array.isArray(data.events) ? data.events : [];
}
