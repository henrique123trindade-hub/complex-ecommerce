import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFirebaseAuthError } from './authErrors';

test('formatFirebaseAuthError returns identical anti-enumeration error for bad login credentials', () => {
  const userNotFound = formatFirebaseAuthError({ code: 'auth/user-not-found' });
  const wrongPassword = formatFirebaseAuthError({ code: 'auth/wrong-password' });
  const invalidCredential = formatFirebaseAuthError({ code: 'auth/invalid-credential' });

  assert.equal(userNotFound, 'E-mail ou senha inválidos.');
  assert.equal(wrongPassword, userNotFound);
  assert.equal(invalidCredential, userNotFound);
});

test('formatFirebaseAuthError handles expired reset codes and rate limits safely', () => {
  assert.match(formatFirebaseAuthError({ code: 'auth/expired-action-code' }), /expirou/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/too-many-requests' }), /Muitas tentativas/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/requires-recent-login' }), /confirme sua identidade/i);
});

test('formatFirebaseAuthError preserves domain authorization guidance', () => {
  const msg = formatFirebaseAuthError({ code: 'auth/unauthorized-domain' }, 'complex-store.app');
  assert.match(msg, /complex-store\.app/);
  assert.match(msg, /Authorized domains/);
});
