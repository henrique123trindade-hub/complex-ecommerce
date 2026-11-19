import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFirebaseAuthError } from './authErrors.ts';

test('formatFirebaseAuthError explains auth/unauthorized-domain with current hostname', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
    code: 'auth/unauthorized-domain',
  });
  const msg = formatFirebaseAuthError(err, 'complex-ecommerce.vercel.app');
  assert.match(msg, /complex-ecommerce\.vercel\.app/);
  assert.match(msg, /Authorized domains/);
});

test('formatFirebaseAuthError handles popup-blocked and popup-closed-by-user gracefully', () => {
  const blocked = formatFirebaseAuthError({ code: 'auth/popup-blocked' });
  assert.match(blocked, /pop-ups/i);

  const closed = formatFirebaseAuthError(new Error('Firebase: Error (auth/popup-closed-by-user).'));
  assert.match(closed, /cancelado/i);
});
