import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
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
} from './authSecurity';

const TEST_SECRET = 'complex-test-hmac-secret-key-2026';

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

test('createSessionToken and verifySessionToken reject tampered and revoked tokens', () => {
  const token = createSessionToken(
    {
      uid: 'uid-user-1',
      role: 'customer',
      emailVerified: true,
      providers: ['password'],
    },
    TEST_SECRET
  );

  const verified = verifySessionToken(token, TEST_SECRET);
  assert.ok(verified);
  assert.equal(verified.uid, 'uid-user-1');
  assert.equal(verified.role, 'customer');

  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifySessionToken(tampered, TEST_SECRET), null);

  const revoked = new Set<string>([verified.jti]);
  assert.equal(verifySessionToken(token, TEST_SECRET, revoked), null);
});

test('CSRF double-submit verification and cookie parsing', () => {
  const token = generateCsrfToken();
  const parsed = parseCookies(`foo=bar; complex_csrf=${encodeURIComponent(token)}`);
  assert.equal(parsed.complex_csrf, token);
  assert.equal(verifyCsrfPair(parsed.complex_csrf, token), true);
  assert.equal(verifyCsrfPair(parsed.complex_csrf, 'invalid-token'), false);
});

test('SlidingWindowRateLimiter blocks after quota exhaustion and resets after window', () => {
  const limiter = new SlidingWindowRateLimiter();
  const t0 = 1_000_000;
  assert.equal(limiter.consume('login:ip1', 2, 60_000, t0).allowed, true);
  assert.equal(limiter.consume('login:ip1', 2, 60_000, t0 + 1000).allowed, true);
  const blocked = limiter.consume('login:ip1', 2, 60_000, t0 + 2000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);

  assert.equal(limiter.consume('login:ip1', 2, 60_000, t0 + 61_000).allowed, true);
});

test('verifyFirebaseIdTokenWithCerts validates RS256 signature, aud, iss, and exp', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', kid: 'kid-1' }));
  const payload = toBase64Url(
    JSON.stringify({
      aud: 'demo-project',
      iss: 'https://securetoken.google.com/demo-project',
      sub: 'uid-admin-99',
      email: 'owner@complex.com',
      email_verified: true,
      iat: now - 10,
      exp: now + 3600,
      firebase: {
        sign_in_provider: 'password',
        identities: { email: ['owner@complex.com'] },
      },
    })
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const sig = toBase64Url(signer.sign(privateKey));
  const jwt = `${header}.${payload}.${sig}`;

  const ok = await verifyFirebaseIdTokenWithCerts(jwt, 'demo-project', {
    'kid-1': publicKey,
  });
  assert.ok(ok);
  assert.equal(ok.uid, 'uid-admin-99');
  assert.equal(ok.emailVerified, true);

  const wrongProject = await verifyFirebaseIdTokenWithCerts(jwt, 'other-project', {
    'kid-1': publicKey,
  });
  assert.equal(wrongProject, null);
});

test('resolveUserRoleFromSources never grants admin to unverified accounts or customers', async () => {
  const unverifiedBootstrap = await resolveUserRoleFromSources({
    uid: 'u1',
    email: 'henrique123trindade@gmail.com',
    emailVerified: false,
    checkFirestoreAdminDoc: async () => true,
    bootstrapAdminEmail: 'henrique123trindade@gmail.com',
  });
  assert.equal(unverifiedBootstrap, 'customer');

  const regularCustomer = await resolveUserRoleFromSources({
    uid: 'u2',
    email: 'cliente@complex.com',
    emailVerified: true,
    checkFirestoreAdminDoc: async () => false,
    bootstrapAdminEmail: 'henrique123trindade@gmail.com',
  });
  assert.equal(regularCustomer, 'customer');

  const verifiedAdminDoc = await resolveUserRoleFromSources({
    uid: 'u3',
    email: 'staff@complex.com',
    emailVerified: true,
    checkFirestoreAdminDoc: async () => true,
    bootstrapAdminEmail: 'henrique123trindade@gmail.com',
  });
  assert.equal(verifiedAdminDoc, 'admin');
});

test('canAccessOrder enforces strict customer ownership and SecurityAuditLogger strips secrets', () => {
  assert.equal(canAccessOrder('u1', { uid: 'u1', role: 'customer' }), true);
  assert.equal(canAccessOrder('u2', { uid: 'u1', role: 'customer' }), false);
  assert.equal(canAccessOrder('guest-demo', { uid: 'u1', role: 'customer' }), false);
  assert.equal(canAccessOrder('u2', { uid: 'admin-1', role: 'admin' }), true);

  const logger = new SecurityAuditLogger(10);
  const entry = logger.record({
    event: 'AUTH_LOGIN_FAILED',
    outcome: 'denied',
    path: '/api/auth/session',
    ip: '192.0.2.10',
    detail: { password: 'SecretPassword123', token: 'secret-jwt', reason: 'invalid' },
  });
  assert.ok(!entry.detail?.includes('SecretPassword123'));
  assert.ok(!entry.detail?.includes('secret-jwt'));
  assert.match(entry.detail || '', /reason=invalid/);
});
