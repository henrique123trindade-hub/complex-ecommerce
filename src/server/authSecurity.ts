import crypto from 'node:crypto';
import type { UserRole } from '../types/store';

export const SESSION_COOKIE_NAME = 'complex_session';
export const CSRF_COOKIE_NAME = 'complex_csrf';

export interface SessionTokenPayload {
  uid: string;
  role: UserRole;
  emailVerified: boolean;
  providers: string[];
  jti: string;
  iat: number;
  exp: number;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
  iat: number;
  exp: number;
}

export interface AuditEventInput {
  event: string;
  outcome: 'success' | 'denied' | 'error';
  uid?: string;
  role?: UserRole | 'guest';
  path: string;
  ip: string;
  detail?: Record<string, unknown>;
}

export interface AuditLogEntry {
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

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function verifyCsrfPair(cookieToken?: string, headerToken?: string): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 16 || headerToken.length < 16) return false;
  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(headerToken, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(
  input: {
    uid: string;
    role: UserRole;
    emailVerified: boolean;
    providers: string[];
  },
  secret: string,
  ttlSeconds = 60 * 60 * 8
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    uid: input.uid,
    role: input.role,
    emailVerified: Boolean(input.emailVerified),
    providers: Array.isArray(input.providers) ? input.providers.slice(0, 6) : [],
    jti: crypto.randomBytes(12).toString('hex'),
    iat: now,
    exp: now + ttlSeconds,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url(crypto.createHmac('sha256', secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  revokedJtis?: Set<string>
): SessionTokenPayload | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = toBase64Url(crypto.createHmac('sha256', secret).update(encoded).digest());
  const actualBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encoded).toString('utf8')) as SessionTokenPayload;
    if (!parsed || typeof parsed.uid !== 'string' || !parsed.uid) return null;
    if (parsed.role !== 'admin' && parsed.role !== 'customer') return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== 'number' || parsed.exp <= now) return null;
    if (revokedJtis && parsed.jti && revokedJtis.has(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();

  consume(
    key: string,
    maxRequests: number,
    windowMs: number,
    nowMs = Date.now()
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const cutoff = nowMs - windowMs;
    const current = (this.buckets.get(key) || []).filter((ts) => ts > cutoff);

    if (current.length >= maxRequests) {
      const oldest = current[0] || nowMs;
      const retryAfterMs = Math.max(1000, windowMs - (nowMs - oldest));
      this.buckets.set(key, current);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    current.push(nowMs);
    this.buckets.set(key, current);

    if (this.buckets.size > 2000) {
      for (const [k, timestamps] of this.buckets.entries()) {
        if (timestamps.every((ts) => ts <= cutoff)) {
          this.buckets.delete(k);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - current.length),
      retryAfterSeconds: 0,
    };
  }
}

let cachedFirebaseCerts: Record<string, string> | null = null;
let cachedFirebaseCertsExpiresAt = 0;

async function fetchFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedFirebaseCerts && now < cachedFirebaseCertsExpiresAt) {
    return cachedFirebaseCerts;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { signal: controller.signal }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Firebase certs: ${res.status}`);
    }
    const certs = (await res.json()) as Record<string, string>;
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
    const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
    cachedFirebaseCerts = certs;
    cachedFirebaseCertsExpiresAt = now + Math.max(60, maxAgeSec) * 1000;
    return certs;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyFirebaseIdTokenWithCerts(
  idToken: string,
  projectId: string,
  overrideCerts?: Record<string, string>
): Promise<VerifiedFirebaseToken | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSig] = parts;

  try {
    const header = JSON.parse(fromBase64Url(encodedHeader).toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      user_id?: string;
      email?: string;
      email_verified?: boolean;
      exp?: number;
      iat?: number;
      firebase?: {
        sign_in_provider?: string;
        identities?: Record<string, unknown>;
      };
    };

    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = overrideCerts || (await fetchFirebasePublicCerts());
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    const signatureBuf = fromBase64Url(encodedSig);
    if (!verifier.verify(certPem, signatureBuf)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const uid = payload.sub || payload.user_id || '';
    if (!uid || uid.length > 128) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.iat !== 'number' || payload.iat > now + 300) return null;

    const identityProviders = payload.firebase?.identities
      ? Object.keys(payload.firebase.identities)
      : [];
    const signInProvider = payload.firebase?.sign_in_provider;
    const providers = Array.from(
      new Set([...(signInProvider ? [signInProvider] : []), ...identityProviders])
    );

    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : '',
      emailVerified: Boolean(payload.email_verified),
      providers,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function resolveUserRoleFromSources(params: {
  uid: string;
  email: string;
  emailVerified: boolean;
  checkFirestoreAdminDoc: () => Promise<boolean>;
  bootstrapAdminEmail?: string;
  extraAdminUids?: Set<string>;
}): Promise<UserRole> {
  if (!params.uid || !params.emailVerified) {
    return 'customer';
  }
  if (params.extraAdminUids?.has(params.uid)) {
    return 'admin';
  }
  if (
    params.bootstrapAdminEmail &&
    params.email &&
    params.email.trim().toLowerCase() === params.bootstrapAdminEmail.trim().toLowerCase()
  ) {
    return 'admin';
  }
  try {
    const isAdminDoc = await params.checkFirestoreAdminDoc();
    if (isAdminDoc) return 'admin';
  } catch {
    // Fall through to customer
  }
  return 'customer';
}

export function canAccessOrder(
  orderUserId: string,
  actor: { uid: string; role: UserRole }
): boolean {
  if (actor.role === 'admin') return true;
  if (!orderUserId || orderUserId === 'guest-demo') return false;
  return orderUserId === actor.uid;
}

const SENSITIVE_DETAIL_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'idtoken',
  'csrftoken',
  'secret',
  'cookie',
  'authorization',
  'cpf',
]);

function sanitizeAuditDetail(detail?: Record<string, unknown>): string | undefined {
  if (!detail) return undefined;
  const safeEntries: string[] = [];
  for (const [key, val] of Object.entries(detail)) {
    if (SENSITIVE_DETAIL_KEYS.has(key.toLowerCase())) continue;
    const serialized = typeof val === 'string' ? val : JSON.stringify(val);
    safeEntries.push(`${key}=${String(serialized).slice(0, 80)}`);
  }
  return safeEntries.length > 0 ? safeEntries.join(' · ') : undefined;
}

export class SecurityAuditLogger {
  private entries: AuditLogEntry[] = [];

  constructor(private readonly maxEntries = 100) {}

  record(input: AuditEventInput): AuditLogEntry {
    const ipHash = crypto
      .createHash('sha256')
      .update(input.ip || 'unknown')
      .digest('hex')
      .slice(0, 12);

    const entry: AuditLogEntry = {
      id: `aud-${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      event: input.event,
      outcome: input.outcome,
      uid: input.uid || 'anonymous',
      role: input.role || 'guest',
      path: input.path,
      ipHash,
      detail: sanitizeAuditDetail(input.detail),
    };

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
    return entry;
  }

  list(limit = 50): AuditLogEntry[] {
    return this.entries.slice(0, limit);
  }
}
