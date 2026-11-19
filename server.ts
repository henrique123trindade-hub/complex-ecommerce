import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { UserRole } from './src/types/store';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SecurityAuditLogger,
  SlidingWindowRateLimiter,
  canAccessOrder,
  createSessionToken,
  generateCsrfToken,
  parseCookies,
  resolveUserRoleFromSources,
  verifyCsrfPair,
  verifyFirebaseIdTokenWithCerts,
  verifySessionToken,
} from './src/server/authSecurity';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as {
  projectId: string;
  firestoreDatabaseId?: string;
};

const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');
const ADMIN_BOOTSTRAP_EMAIL = (
  process.env.ADMIN_BOOTSTRAP_EMAIL || 'henrique123trindade@gmail.com'
)
  .trim()
  .toLowerCase();
const EXTRA_ADMIN_UIDS = new Set(
  (process.env.ADMIN_UIDS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
);

const rateLimiter = new SlidingWindowRateLimiter();
const auditLogger = new SecurityAuditLogger(120);
const revokedSessionJtis = new Set<string>();

interface RequestAuthContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  providers: string[];
  sessionJti?: string;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: RequestAuthContext | null;
    }
  }
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function buildCookieString(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAgeSeconds: number;
    https: boolean;
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.https) {
    parts.push('SameSite=None', 'Secure');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

function ensureCsrfCookie(req: Request, res: Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing && existing.length >= 16) {
    return existing;
  }
  const fresh = generateCsrfToken();
  res.append(
    'Set-Cookie',
    buildCookieString(CSRF_COOKIE_NAME, fresh, {
      httpOnly: false,
      maxAgeSeconds: 60 * 60 * 12,
      https: isHttpsRequest(req),
    })
  );
  return fresh;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function checkFirestoreAdminDocWithUserToken(
  uid: string,
  idToken: string
): Promise<boolean> {
  if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_ID
  )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/admins/${encodeURIComponent(
    uid
  )}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const docData = (await res.json()) as {
      fields?: {
        role?: { stringValue?: string };
        active?: { booleanValue?: boolean };
      };
    };
    const roleVal = docData.fields?.role?.stringValue;
    const activeVal = docData.fields?.active?.booleanValue;
    return roleVal === 'admin' && activeVal !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveRequestAuth(req: Request): Promise<RequestAuthContext | null> {
  if (req.authContext !== undefined) {
    return req.authContext;
  }

  const authHeader = req.get('authorization') || '';
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (bearerMatch?.[1]) {
    const idToken = bearerMatch[1].trim();
    const verified = await verifyFirebaseIdTokenWithCerts(idToken, FIREBASE_PROJECT_ID);
    if (!verified) {
      req.authContext = null;
      return null;
    }
    const role = await resolveUserRoleFromSources({
      uid: verified.uid,
      email: verified.email,
      emailVerified: verified.emailVerified,
      checkFirestoreAdminDoc: () => checkFirestoreAdminDocWithUserToken(verified.uid, idToken),
      bootstrapAdminEmail: ADMIN_BOOTSTRAP_EMAIL,
      extraAdminUids: EXTRA_ADMIN_UIDS,
    });
    const ctx: RequestAuthContext = {
      uid: verified.uid,
      email: verified.email,
      emailVerified: verified.emailVerified,
      role,
      providers: verified.providers,
    };
    req.authContext = ctx;
    return ctx;
  }

  const cookies = parseCookies(req.headers.cookie);
  const session = verifySessionToken(
    cookies[SESSION_COOKIE_NAME],
    SESSION_SECRET,
    revokedSessionJtis
  );
  if (!session) {
    req.authContext = null;
    return null;
  }

  const ctx: RequestAuthContext = {
    uid: session.uid,
    email: '',
    emailVerified: session.emailVerified,
    role: session.role,
    providers: session.providers,
    sessionJti: session.jti,
  };
  req.authContext = ctx;
  return ctx;
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.get('x-csrf-token');
  if (!verifyCsrfPair(cookieToken, headerToken)) {
    auditLogger.record({
      event: 'CSRF_VALIDATION_FAILED',
      outcome: 'denied',
      path: req.path,
      ip: getClientIp(req),
    });
    return res.status(403).json({
      error: 'Validação de segurança (CSRF) expirada. Atualize a página e tente novamente.',
    });
  }
  next();
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authCtx = await resolveRequestAuth(req);
  if (!authCtx) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authCtx = await resolveRequestAuth(req);
  if (!authCtx) {
    auditLogger.record({
      event: 'ADMIN_ACCESS_DENIED',
      outcome: 'denied',
      path: req.path,
      ip: getClientIp(req),
      detail: { reason: 'unauthenticated' },
    });
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  if (authCtx.role !== 'admin' || !authCtx.emailVerified) {
    auditLogger.record({
      event: 'ADMIN_ACCESS_DENIED',
      outcome: 'denied',
      uid: authCtx.uid,
      role: authCtx.role,
      path: req.path,
      ip: getClientIp(req),
      detail: { reason: 'insufficient_role' },
    });
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  next();
}

const app = express();
app.use(express.json({ limit: '8mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(['/api/auth', '/api/admin'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory demo session order buffer (guest demo checkout orders; authenticated orders also persist to Firestore)
const sessionDemoOrders: Record<string, unknown>[] = [];

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'complex-storefront' });
});

app.get('/api/auth/csrf', (req, res) => {
  const csrfToken = ensureCsrfCookie(req, res);
  res.json({ csrfToken });
});

app.get('/api/auth/session', async (req, res) => {
  const csrfToken = ensureCsrfCookie(req, res);
  const authCtx = await resolveRequestAuth(req);
  if (!authCtx) {
    return res.json({
      authenticated: false,
      uid: null,
      role: null,
      emailVerified: false,
      providers: [],
      csrfToken,
    });
  }
  return res.json({
    authenticated: true,
    uid: authCtx.uid,
    role: authCtx.role,
    emailVerified: authCtx.emailVerified,
    providers: authCtx.providers,
    csrfToken,
  });
});

app.post('/api/auth/rate-check', requireCsrf, (req, res) => {
  const body = (req.body || {}) as { action?: string; identifier?: string };
  const action = String(body.action || 'login');
  const allowedActions = new Set([
    'login',
    'register',
    'password-reset',
    'resend-verification',
    'link-account',
  ]);
  if (!allowedActions.has(action)) {
    return res.status(400).json({ error: 'Ação de autenticação inválida.' });
  }

  const ip = getClientIp(req);
  const rawId = String(body.identifier || '').trim().toLowerCase();
  const idHash = rawId
    ? crypto.createHash('sha256').update(rawId).digest('hex').slice(0, 12)
    : 'anon';

  const maxRequests = action === 'password-reset' || action === 'resend-verification' ? 5 : 10;
  const windowMs = 15 * 60 * 1000;
  const ipQuota = rateLimiter.consume(`auth:${action}:ip:${ip}`, maxRequests * 2, windowMs);
  const accountQuota = rateLimiter.consume(`auth:${action}:id:${ip}:${idHash}`, maxRequests, windowMs);

  if (!ipQuota.allowed || !accountQuota.allowed) {
    const retryAfter = Math.max(ipQuota.retryAfterSeconds, accountQuota.retryAfterSeconds);
    auditLogger.record({
      event: 'RATE_LIMIT_TRIGGERED',
      outcome: 'denied',
      path: req.path,
      ip,
      detail: { action, retryAfter },
    });
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Muitas tentativas em sequência. Aguarde ${retryAfter}s antes de tentar novamente.`,
      retryAfterSeconds: retryAfter,
    });
  }

  return res.json({ allowed: true });
});

app.post('/api/auth/session', requireCsrf, async (req, res) => {
  const ip = getClientIp(req);
  const quota = rateLimiter.consume(`auth:session:${ip}`, 40, 5 * 60 * 1000);
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    return res.status(429).json({ error: 'Limite de sincronização de sessão excedido.' });
  }

  const body = (req.body || {}) as { idToken?: string };
  const bearerHeader = req.get('authorization') || '';
  const bearerToken = /^Bearer\s+(.+)$/i.exec(bearerHeader)?.[1]?.trim();
  const idToken = typeof body.idToken === 'string' && body.idToken ? body.idToken : bearerToken;

  if (!idToken) {
    return res.status(401).json({ error: 'Credencial de autenticação ausente.' });
  }

  const verified = await verifyFirebaseIdTokenWithCerts(idToken, FIREBASE_PROJECT_ID);
  if (!verified) {
    auditLogger.record({
      event: 'AUTH_SESSION_FAILED',
      outcome: 'denied',
      path: req.path,
      ip,
      detail: { reason: 'invalid_firebase_token' },
    });
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  const role = await resolveUserRoleFromSources({
    uid: verified.uid,
    email: verified.email,
    emailVerified: verified.emailVerified,
    checkFirestoreAdminDoc: () => checkFirestoreAdminDocWithUserToken(verified.uid, idToken),
    bootstrapAdminEmail: ADMIN_BOOTSTRAP_EMAIL,
    extraAdminUids: EXTRA_ADMIN_UIDS,
  });

  const sessionToken = createSessionToken(
    {
      uid: verified.uid,
      role,
      emailVerified: verified.emailVerified,
      providers: verified.providers,
    },
    SESSION_SECRET
  );

  res.append(
    'Set-Cookie',
    buildCookieString(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      maxAgeSeconds: 60 * 60 * 8,
      https: isHttpsRequest(req),
    })
  );

  auditLogger.record({
    event: 'AUTH_SESSION_ESTABLISHED',
    outcome: 'success',
    uid: verified.uid,
    role,
    path: req.path,
    ip,
    detail: { providers: verified.providers.join(',') },
  });

  return res.json({
    authenticated: true,
    uid: verified.uid,
    role,
    emailVerified: verified.emailVerified,
    providers: verified.providers,
  });
});

app.post('/api/auth/logout', requireCsrf, async (req, res) => {
  const authCtx = await resolveRequestAuth(req);
  if (authCtx?.sessionJti) {
    revokedSessionJtis.add(authCtx.sessionJti);
  }
  res.append(
    'Set-Cookie',
    buildCookieString(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      maxAgeSeconds: 0,
      https: isHttpsRequest(req),
    })
  );
  auditLogger.record({
    event: 'AUTH_LOGOUT',
    outcome: 'success',
    uid: authCtx?.uid || 'anonymous',
    role: authCtx?.role || 'guest',
    path: req.path,
    ip: getClientIp(req),
  });
  return res.json({ ok: true });
});

app.post('/api/auth/security-event', requireCsrf, async (req, res) => {
  const authCtx = await resolveRequestAuth(req);
  const body = (req.body || {}) as {
    event?: string;
    outcome?: 'success' | 'denied' | 'error';
    detail?: Record<string, unknown>;
  };
  const allowedEvents = new Set([
    'AUTH_LOGIN_FAILED',
    'AUTH_REGISTER',
    'AUTH_PASSWORD_RESET_REQUEST',
    'AUTH_PASSWORD_RESET_CONFIRMED',
    'AUTH_EMAIL_VERIFICATION_SENT',
    'AUTH_ACCOUNT_LINKED',
    'AUTH_PASSWORD_UPDATED',
  ]);
  const eventName = String(body.event || '');
  if (!allowedEvents.has(eventName)) {
    return res.status(400).json({ error: 'Evento inválido.' });
  }
  auditLogger.record({
    event: eventName,
    outcome: body.outcome === 'denied' || body.outcome === 'error' ? body.outcome : 'success',
    uid: authCtx?.uid || 'anonymous',
    role: authCtx?.role || 'guest',
    path: req.path,
    ip: getClientIp(req),
    detail: body.detail,
  });
  return res.json({ ok: true });
});

app.get('/api/admin/access', requireAuth, requireAdmin, (req, res) => {
  const authCtx = req.authContext!;
  auditLogger.record({
    event: 'ADMIN_ACCESS_GRANTED',
    outcome: 'success',
    uid: authCtx.uid,
    role: authCtx.role,
    path: req.path,
    ip: getClientIp(req),
  });
  return res.json({
    authorized: true,
    role: 'admin',
    uid: authCtx.uid,
  });
});

app.get('/api/admin/audit-logs', requireAuth, requireAdmin, (req, res) => {
  const authCtx = req.authContext!;
  auditLogger.record({
    event: 'ADMIN_AUDIT_VIEWED',
    outcome: 'success',
    uid: authCtx.uid,
    role: authCtx.role,
    path: req.path,
    ip: getClientIp(req),
  });
  return res.json({ events: auditLogger.list(50) });
});

// Brazilian CEP lookup with graceful fallback for offline/hermetic environments
app.get('/api/cep/:cep', async (req, res) => {
  const raw = String(req.params.cep || '').replace(/\D/g, '');
  if (raw.length !== 8) {
    return res.status(400).json({ error: 'CEP deve conter 8 dígitos.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      if (!data.erro) {
        return res.json({
          cep: `${raw.slice(0, 5)}-${raw.slice(5)}`,
          street: String(data.logradouro || ''),
          neighborhood: String(data.bairro || ''),
          city: String(data.localidade || ''),
          state: String(data.uf || ''),
          source: 'viacep',
        });
      }
    }
  } catch {
    // Fallback below if network lookup is unavailable
  }

  const first = Number(raw[0]);
  const fallbackRegion =
    first === 0 || first === 1
      ? { city: 'São Paulo', state: 'SP' }
      : first === 2
      ? { city: 'Rio de Janeiro', state: 'RJ' }
      : first === 3
      ? { city: 'Belo Horizonte', state: 'MG' }
      : first === 8
      ? { city: 'Curitiba', state: 'PR' }
      : { city: 'Brasília', state: 'DF' };

  return res.json({
    cep: `${raw.slice(0, 5)}-${raw.slice(5)}`,
    street: '',
    neighborhood: '',
    city: fallbackRegion.city,
    state: fallbackRegion.state,
    source: 'region-estimate',
  });
});

// Demo checkout order registration with server-enforced ownership & CSRF
app.post('/api/orders', requireCsrf, async (req, res) => {
  const authCtx = await resolveRequestAuth(req);
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body.customerName !== 'string' || typeof body.customerEmail !== 'string') {
    return res.status(400).json({ error: 'Dados do cliente obrigatórios.' });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return res.status(400).json({ error: 'Carrinho vazio ou inválido.' });
  }

  const authoritativeUserId = authCtx?.uid || 'guest-demo';
  const orderId = String(body.id || `ord-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const orderNumber = String(
    body.orderNumber || `CMP-${Math.floor(10000 + Math.random() * 90000)}`
  ).slice(0, 32);
  const now = new Date().toISOString();

  const record = {
    ...body,
    id: orderId || `ord-${Date.now()}`,
    orderNumber,
    userId: authoritativeUserId,
    status: 'demo_pending',
    isDemo: true,
    paymentGatewayStatus: 'DEMO_MODE_NO_CHARGE',
    createdAt: now,
    updatedAt: now,
  };

  sessionDemoOrders.unshift(record);
  if (sessionDemoOrders.length > 50) sessionDemoOrders.pop();

  auditLogger.record({
    event: 'ORDER_CREATED',
    outcome: 'success',
    uid: authoritativeUserId,
    role: authCtx?.role || 'guest',
    path: req.path,
    ip: getClientIp(req),
    detail: { orderNumber },
  });

  return res.status(201).json(record);
});

app.get('/api/orders/session', requireAuth, (req, res) => {
  const authCtx = req.authContext!;
  const scopedOrders = sessionDemoOrders.filter((ord) =>
    canAccessOrder(String(ord.userId || ''), {
      uid: authCtx.uid,
      role: authCtx.role,
    })
  );
  return res.json({ orders: scopedOrders });
});

// Multi-turn Style & Fit Assistant (server-side Gemini)
app.post('/api/ai/style-advisor', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Consultoria inteligente indisponível no momento: configure GEMINI_API_KEY no ambiente do servidor.',
    });
  }

  try {
    const { messages, catalogSummary, deepMode } = req.body as {
      messages: { role: 'user' | 'model'; text: string }[];
      catalogSummary?: string;
      deepMode?: boolean;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Envie uma mensagem para iniciar a consulta.' });
    }

    const systemInstruction = `Você é o consultor de estilo, modelagem e caimento da marca independente COMPLEX (streetwear contemporâneo, paleta Bone #F1EEE8, Carbon #171717, Olive #6A705C, Taupe #B6A18C).
Responda sempre em português do Brasil, com tom discreto, direto, editorial e preciso — sem exageros comerciais, sem emojis e sem inventar certificações ou políticas que não existem.
Ajude o cliente a escolher tamanho (XS a XL ou numeração 38-46), entender proporções oversized/boxy e combinar peças do catálogo abaixo:
${catalogSummary || 'Moletom Essencial Estonado, Camiseta Boxy Pesada, Camiseta Oversized Diária, Calça Jeans Wide Arquitetônica, Moletom Canguru Areia 500g, Calça Cargo Utilitária Ripstop, Jaqueta Corta-Vento Cropped, Jaqueta Puffer Volume, Moletom Careca Boxy Tingido, Boné Sarja 6 Gomos & Ecobag Lona.'}`;

    const lastUserMessage = messages[messages.length - 1]?.text || '';
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const model = deepMode ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
    const chat = ai.chats.create({
      model,
      history,
      config: {
        systemInstruction,
        ...(deepMode ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
      },
    });

    const response = await chat.sendMessage({ message: lastUserMessage });
    return res.json({ reply: response.text || '', model });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao consultar assistente.';
    console.error('Style advisor error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// Outfit / Garment Image Understanding (server-side Gemini multimodal)
app.post('/api/ai/analyze-garment', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Análise visual indisponível: configure GEMINI_API_KEY no servidor.',
    });
  }

  try {
    const { imageBase64, mimeType, question, catalogSummary } = req.body as {
      imageBase64: string;
      mimeType: string;
      question?: string;
      catalogSummary?: string;
    };

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Imagem obrigatória para análise.' });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: `${
              question ||
              'Analise as proporções, paleta de cores e estilo desta peça ou look e sugira até 3 peças do catálogo COMPLEX que criam uma composição coerente.'
            }\n\nCatálogo COMPLEX disponível:\n${catalogSummary || ''}`,
          },
        ],
      },
      config: {
        systemInstruction:
          'Você é o diretor criativo e estilista da COMPLEX. Responda em português do Brasil de forma concisa, técnica e editorial, sem emojis.',
      },
    });

    return res.json({ analysis: response.text || '' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro na análise da imagem.';
    console.error('Analyze garment error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// Admin copy assistant (strictly protected by CSRF + Auth + Admin RBAC)
app.post('/api/ai/catalog-copy', requireCsrf, requireAuth, requireAdmin, async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Assistente editorial indisponível: configure GEMINI_API_KEY no servidor.',
    });
  }

  try {
    const authCtx = req.authContext!;
    const { productName, category, fitNotes } = req.body as {
      productName: string;
      category: string;
      fitNotes?: string;
    };

    auditLogger.record({
      event: 'ADMIN_AI_COPY_GENERATED',
      outcome: 'success',
      uid: authCtx.uid,
      role: authCtx.role,
      path: req.path,
      ip: getClientIp(req),
      detail: { category },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Escreva uma descrição de produto sóbria, técnica e editorial (máximo 2 frases) em português do Brasil para a peça "${productName}" da categoria "${category}". Notas de modelagem: ${fitNotes || 'oversized contemporâneo'}. Não invente certificações ou dados falsos.`,
    });

    return res.json({ description: (response.text || '').trim() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao gerar descrição.';
    return res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.endsWith('/sw.js') || normalized.endsWith('/index.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          } else if (
            normalized.includes('/assets/') ||
            normalized.includes('/src/assets/images/optimized/')
          ) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`COMPLEX storefront server listening on http://localhost:${port}`);
  });
}

startServer();
