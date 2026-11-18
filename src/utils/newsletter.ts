export const NEWSLETTER_EMAIL_MIN_LENGTH = 5;
export const NEWSLETTER_EMAIL_MAX_LENGTH = 160;

export type NewsletterValidationStatus = 'idle' | 'valid' | 'invalid';

export interface NewsletterEmailValidation {
  normalized: string;
  status: NewsletterValidationStatus;
  message: string | null;
}

const LOCAL_PART_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PART_PATTERN = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

export function validateNewsletterEmail(
  rawEmail: string,
  options?: { enforceRequired?: boolean }
): NewsletterEmailValidation {
  const trimmed = rawEmail.trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed) {
    if (options?.enforceRequired) {
      return {
        normalized: '',
        status: 'invalid',
        message: 'Informe seu endereço de e-mail.',
      };
    }
    return {
      normalized: '',
      status: 'idle',
      message: null,
    };
  }

  if (trimmed.length > NEWSLETTER_EMAIL_MAX_LENGTH) {
    return {
      normalized,
      status: 'invalid',
      message: `O e-mail deve ter no máximo ${NEWSLETTER_EMAIL_MAX_LENGTH} caracteres.`,
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      normalized,
      status: 'invalid',
      message: 'O endereço de e-mail não pode conter espaços.',
    };
  }

  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) {
    return {
      normalized,
      status: 'invalid',
      message: 'Inclua um "@" no endereço de e-mail.',
    };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return {
      normalized,
      status: 'invalid',
      message: 'O e-mail deve conter apenas um "@".',
    };
  }

  const [localPart, domainPart] = parts;

  if (
    !localPart ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !LOCAL_PART_PATTERN.test(localPart)
  ) {
    return {
      normalized,
      status: 'invalid',
      message: 'Verifique a parte do e-mail antes do "@".',
    };
  }

  if (!domainPart) {
    return {
      normalized,
      status: 'invalid',
      message: 'Informe o domínio após o "@".',
    };
  }

  if (
    !domainPart.includes('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.includes('..') ||
    !DOMAIN_PART_PATTERN.test(domainPart)
  ) {
    return {
      normalized,
      status: 'invalid',
      message: 'Informe um domínio válido (ex.: nome@dominio.com).',
    };
  }

  if (trimmed.length < NEWSLETTER_EMAIL_MIN_LENGTH) {
    return {
      normalized,
      status: 'invalid',
      message: 'Formato de e-mail inválido. Ex.: nome@dominio.com.',
    };
  }

  return {
    normalized,
    status: 'valid',
    message: null,
  };
}

export function formatNewsletterSubmissionError(err: unknown): string {
  const fallback = 'Não foi possível concluir a inscrição. Tente novamente em instantes.';
  if (!(err instanceof Error)) return fallback;

  const raw = err.message.trim();
  if (!raw) return fallback;

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      const inner = parsed.error || '';
      if (/quota exceeded/i.test(inner)) {
        return 'Limite diário de gravações atingido no momento. Tente novamente amanhã.';
      }
      if (/permission|insufficient/i.test(inner)) {
        return 'Não foi possível validar o envio agora. Verifique os dados e tente novamente.';
      }
      if (/offline|network|unavailable/i.test(inner)) {
        return 'Sem conexão com o servidor no momento. Verifique sua internet e tente novamente.';
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  if (/quota exceeded/i.test(raw)) {
    return 'Limite diário de gravações atingido no momento. Tente novamente amanhã.';
  }

  return raw;
}
