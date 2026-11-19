export interface PasswordPolicyChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  checks: PasswordPolicyChecks;
  errors: string[];
}

export function normalizeAuthEmail(rawEmail: string): string {
  return String(rawEmail || '').trim().toLowerCase();
}

export function validateAuthEmail(rawEmail: string): {
  valid: boolean;
  normalized: string;
  message?: string;
} {
  const normalized = normalizeAuthEmail(rawEmail);
  if (!normalized) {
    return { valid: false, normalized, message: 'Informe seu endereço de e-mail.' };
  }
  if (normalized.length > 160) {
    return { valid: false, normalized, message: 'O e-mail excede o limite máximo de caracteres.' };
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(normalized)) {
    return { valid: false, normalized, message: 'Informe um endereço de e-mail válido.' };
  }
  return { valid: true, normalized };
}

export function validateAuthName(rawName: string): {
  valid: boolean;
  normalized: string;
  message?: string;
} {
  const normalized = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) {
    return { valid: false, normalized, message: 'Informe seu nome completo (mínimo 2 caracteres).' };
  }
  if (normalized.length > 120) {
    return { valid: false, normalized, message: 'O nome deve ter no máximo 120 caracteres.' };
  }
  return { valid: true, normalized };
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const value = String(password || '');
  const checks: PasswordPolicyChecks = {
    minLength: value.length >= 8 && value.length <= 128,
    hasUppercase: /[A-Z]/.test(value),
    hasLowercase: /[a-z]/.test(value),
    hasDigit: /\d/.test(value),
  };

  const errors: string[] = [];
  if (value.length < 8) errors.push('A senha deve ter pelo menos 8 caracteres.');
  if (value.length > 128) errors.push('A senha deve ter no máximo 128 caracteres.');
  if (!checks.hasUppercase) errors.push('Inclua pelo menos uma letra maiúscula.');
  if (!checks.hasLowercase) errors.push('Inclua pelo menos uma letra minúscula.');
  if (!checks.hasDigit) errors.push('Inclua pelo menos um número.');

  return {
    valid: errors.length === 0,
    checks,
    errors,
  };
}

export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): { valid: boolean; message?: string } {
  if (!confirmPassword) {
    return { valid: false, message: 'Confirme sua senha.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, message: 'As senhas informadas não coincidem.' };
  }
  return { valid: true };
}
