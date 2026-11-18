import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNewsletterSubmissionError,
  NEWSLETTER_EMAIL_MAX_LENGTH,
  validateNewsletterEmail,
} from './newsletter';

test('validateNewsletterEmail handles idle vs required empty inputs', () => {
  const idle = validateNewsletterEmail('   ');
  assert.equal(idle.status, 'idle');
  assert.equal(idle.message, null);

  const required = validateNewsletterEmail('   ', { enforceRequired: true });
  assert.equal(required.status, 'invalid');
  assert.match(required.message || '', /e-mail/i);
});

test('validateNewsletterEmail catches invalid formats in real time', () => {
  assert.equal(validateNewsletterEmail('joao').status, 'invalid');
  assert.match(validateNewsletterEmail('joao').message || '', /@/);

  assert.equal(validateNewsletterEmail('joao@').status, 'invalid');
  assert.match(validateNewsletterEmail('joao@').message || '', /domínio/i);

  assert.equal(validateNewsletterEmail('joao@dominio').status, 'invalid');
  assert.equal(validateNewsletterEmail('joao@dominio.c').status, 'invalid');
  assert.equal(validateNewsletterEmail('joao..silva@dominio.com').status, 'invalid');
  assert.equal(validateNewsletterEmail('joao silva@dominio.com').status, 'invalid');
  assert.equal(validateNewsletterEmail('joao@sub@dominio.com').status, 'invalid');

  const overLimit = `${'a'.repeat(NEWSLETTER_EMAIL_MAX_LENGTH)}@complex.com`;
  assert.equal(validateNewsletterEmail(overLimit).status, 'invalid');
});

test('validateNewsletterEmail accepts valid normalized addresses', () => {
  const valid = validateNewsletterEmail('  Cliente.BR@Complex.com.br  ');
  assert.equal(valid.status, 'valid');
  assert.equal(valid.normalized, 'cliente.br@complex.com.br');
  assert.equal(valid.message, null);
});

test('formatNewsletterSubmissionError maps raw Firestore JSON errors cleanly', () => {
  const quotaErr = new Error(
    JSON.stringify({ error: 'Quota exceeded for quota metric', operationType: 'create', path: 'newsletter/sub-1' })
  );
  assert.match(formatNewsletterSubmissionError(quotaErr), /Limite diário/i);

  const plainErr = new Error('Confirme o consentimento para recebimento de novidades.');
  assert.equal(
    formatNewsletterSubmissionError(plainErr),
    'Confirme o consentimento para recebimento de novidades.'
  );
});
