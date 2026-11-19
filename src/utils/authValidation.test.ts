import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAuthProviders,
  formatAuthProvidersLabel,
  mergeAuthProviders,
  sanitizeInternalRedirect,
  validateAuthDisplayName,
  validateAuthEmail,
  validatePasswordConfirmation,
  validatePasswordStrength,
} from './authValidation';
import { formatFirebaseAuthError } from './authErrors';

test('validateAuthDisplayName and validateAuthEmail enforce clean inputs', () => {
  assert.equal(validateAuthDisplayName('  Ana   Clara ').valid, true);
  assert.equal(validateAuthDisplayName('  Ana   Clara ').normalized, 'Ana Clara');
  assert.equal(validateAuthDisplayName('A').valid, false);
  assert.equal(validateAuthDisplayName('').valid, false);

  assert.equal(validateAuthEmail('  Cliente@COMPLEX.com.br ').valid, true);
  assert.equal(validateAuthEmail('  Cliente@COMPLEX.com.br ').normalized, 'cliente@complex.com.br');
  assert.equal(validateAuthEmail('invalido').valid, false);
  assert.equal(validateAuthEmail('').valid, false);
});

test('validatePasswordStrength enforces minimum length, upper, lower, and digit rules', () => {
  assert.equal(validatePasswordStrength('1234567').valid, false);
  assert.equal(validatePasswordStrength('abcdefgh').valid, false);
  assert.equal(validatePasswordStrength('Abcdefgh').valid, false);
  assert.equal(validatePasswordStrength('ABCDEF12').valid, false);
  assert.equal(validatePasswordStrength('Complex2026').valid, true);

  assert.equal(validatePasswordConfirmation('Complex2026', 'Complex2026').valid, true);
  assert.equal(validatePasswordConfirmation('Complex2026', 'Outra2026').valid, false);
});

test('extractAuthProviders, mergeAuthProviders, and formatAuthProvidersLabel handle single and linked identities without inventing data', () => {
  assert.deepEqual(extractAuthProviders([{ providerId: 'google.com' }]), ['google']);
  assert.deepEqual(extractAuthProviders([{ providerId: 'password' }]), ['password']);
  assert.deepEqual(
    extractAuthProviders([{ providerId: 'google.com' }, { providerId: 'password' }]),
    ['google', 'password']
  );
  assert.deepEqual(mergeAuthProviders(['google'], ['password']), ['google', 'password']);

  assert.equal(formatAuthProvidersLabel(undefined), '—');
  assert.equal(formatAuthProvidersLabel([]), '—');
  assert.equal(formatAuthProvidersLabel(['google']), 'Google');
  assert.equal(formatAuthProvidersLabel(['password']), 'E-mail e senha');
  assert.equal(formatAuthProvidersLabel(['google', 'password']), 'Google · E-mail e senha');
});

test('sanitizeInternalRedirect permits only safe storefront checkout/shop paths', () => {
  assert.equal(sanitizeInternalRedirect('?redirect=/checkout'), '/checkout');
  assert.equal(sanitizeInternalRedirect('?redirect=/bag'), '/bag');
  assert.equal(sanitizeInternalRedirect('?redirect=/admin'), null);
  assert.equal(sanitizeInternalRedirect('?redirect=https://evil.example'), null);
  assert.equal(sanitizeInternalRedirect('?redirect=//evil.example'), null);
});

test('formatFirebaseAuthError maps email/password and Google auth error codes to clear pt-BR messages', () => {
  assert.match(formatFirebaseAuthError({ code: 'auth/email-already-in-use' }), /já está cadastrado/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/invalid-credential' }), /incorretos/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/weak-password' }), /requisitos mínimos/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/operation-not-allowed' }), /Firebase Console/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/too-many-requests' }), /Muitas tentativas/i);
  assert.match(formatFirebaseAuthError({ code: 'auth/popup-blocked' }), /pop-ups/i);
});
