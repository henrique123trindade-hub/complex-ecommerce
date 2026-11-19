import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAuthEmail,
  validateAuthEmail,
  validateAuthName,
  validatePasswordMatch,
  validatePasswordStrength,
} from './authValidation';

test('normalizeAuthEmail trims whitespace and lowercases input', () => {
  assert.equal(normalizeAuthEmail('  Cliente@COMPLEX.com.BR '), 'cliente@complex.com.br');
});

test('validateAuthEmail rejects invalid and empty emails', () => {
  assert.equal(validateAuthEmail('').valid, false);
  assert.equal(validateAuthEmail('sem-arroba').valid, false);
  assert.equal(validateAuthEmail('user@domain').valid, false);
  const ok = validateAuthEmail('cliente@complex.com.br');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'cliente@complex.com.br');
});

test('validateAuthName enforces length boundaries and normalizes spaces', () => {
  assert.equal(validateAuthName('A').valid, false);
  const ok = validateAuthName('  Marina   Costa ');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'Marina Costa');
});

test('validatePasswordStrength enforces strong policy requirements', () => {
  assert.equal(validatePasswordStrength('abc123').valid, false);
  assert.equal(validatePasswordStrength('semnumeroA').valid, false);
  assert.equal(validatePasswordStrength('semmaiuscula1').valid, false);
  assert.equal(validatePasswordStrength('SEMMINUSCULA1').valid, false);
  const strong = validatePasswordStrength('Complex2026');
  assert.equal(strong.valid, true);
  assert.equal(strong.errors.length, 0);
});

test('validatePasswordMatch verifies identical passwords', () => {
  assert.equal(validatePasswordMatch('Complex2026', 'Complex2025').valid, false);
  assert.equal(validatePasswordMatch('Complex2026', 'Complex2026').valid, true);
});
