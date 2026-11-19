import type { AuthProviderId } from '../types/store';

export interface PasswordStrengthResult {
  valid: boolean;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
  };
  message: string;
}

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAuthDisplayName(raw: string): { valid: boolean; normalized: string; message: string } {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { valid: false, normalized: '', message: 'Informe seu nome completo.' };
  }
  if (normalized.length < 2) {
    return { valid: false, normalized, message: 'O nome deve ter pelo menos 2 caracteres.' };
  }
  if (normalized.length > 120) {
    return { valid: false, normalized: normalized.slice(0, 120), message: 'O nome pode ter no máximo 120 caracteres.' };
  }
  return { valid: true, normalized, message: '' };
}

export function validateAuthEmail(raw: string): { valid: boolean; normalized: string; message: string } {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, normalized: '', message: 'Informe seu e-mail.' };
  }
  if (normalized.length > 160 || !SIMPLE_EMAIL_REGEX.test(normalized)) {
    return { valid: false, normalized, message: 'Informe um endereço de e-mail válido.' };
  }
  return { valid: true, normalized, message: '' };
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8 && password.length <= 128,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  if (!password) {
    return { valid: false, checks, message: 'Crie uma senha para sua conta.' };
  }
  if (!checks.minLength) {
    return {
      valid: false,
      checks,
      message: 'A senha deve conter entre 8 e 128 caracteres.',
    };
  }
  if (!checks.hasUpper || !checks.hasLower || !checks.hasNumber) {
    return {
      valid: false,
      checks,
      message: 'Use letra maiúscula, letra minúscula e pelo menos um número.',
    };
  }

  return { valid: true, checks, message: '' };
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string
): { valid: boolean; message: string } {
  if (!confirmPassword) {
    return { valid: false, message: 'Confirme sua senha.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, message: 'As senhas não coincidem.' };
  }
  return { valid: true, message: '' };
}

export function extractAuthProviders(
  providerData?: Array<{ providerId?: string | null }> | null
): AuthProviderId[] {
  if (!Array.isArray(providerData)) return [];
  const found = new Set<AuthProviderId>();
  for (const item of providerData) {
    const id = item?.providerId;
    if (id === 'google.com' || id === 'google') {
      found.add('google');
    } else if (id === 'password') {
      found.add('password');
    }
  }
  return Array.from(found);
}

export function mergeAuthProviders(
  existing?: AuthProviderId[] | null,
  incoming?: AuthProviderId[] | null
): AuthProviderId[] {
  const merged = new Set<AuthProviderId>();
  for (const p of existing || []) {
    if (p === 'google' || p === 'password') merged.add(p);
  }
  for (const p of incoming || []) {
    if (p === 'google' || p === 'password') merged.add(p);
  }
  return Array.from(merged);
}

export function formatAuthProvidersLabel(providers?: AuthProviderId[]): string {
  if (!Array.isArray(providers) || providers.length === 0) return '—';
  const labels: string[] = [];
  if (providers.includes('google')) labels.push('Google');
  if (providers.includes('password')) labels.push('E-mail e senha');
  return labels.length > 0 ? labels.join(' · ') : '—';
}

const ALLOWED_REDIRECT_PREFIXES = ['/checkout', '/bag', '/shop', '/product/'];

export function sanitizeInternalRedirect(rawSearch: string): string | null {
  try {
    const params = new URLSearchParams(rawSearch);
    const target = (params.get('redirect') || '').trim();
    if (!target || !target.startsWith('/') || target.startsWith('//')) {
      return null;
    }
    if (ALLOWED_REDIRECT_PREFIXES.some((prefix) => target === prefix || target.startsWith(prefix))) {
      return target;
    }
    return null;
  } catch {
    return null;
  }
}
