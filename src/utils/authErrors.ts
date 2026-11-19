export function formatFirebaseAuthError(error: unknown, hostname?: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const hay = `${code} ${message}`;

  if (code === 'auth/unauthorized-domain' || hay.includes('auth/unauthorized-domain')) {
    const cleanHost = hostname?.trim();
    if (cleanHost) {
      return `O domínio "${cleanHost}" ainda não está autorizado no Firebase Authentication. Adicione "${cleanHost}" em Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    return 'Este domínio ainda não está autorizado no Firebase Authentication. Adicione-o em Firebase Console > Authentication > Settings > Authorized domains.';
  }

  // Anti-enumeration: identical response for unknown email vs wrong password
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    hay.includes('auth/invalid-credential') ||
    hay.includes('auth/wrong-password') ||
    hay.includes('auth/user-not-found')
  ) {
    return 'E-mail ou senha inválidos.';
  }

  if (code === 'auth/invalid-email' || hay.includes('auth/invalid-email')) {
    return 'Informe um endereço de e-mail válido.';
  }

  if (code === 'auth/email-already-in-use' || hay.includes('auth/email-already-in-use')) {
    return 'Não foi possível concluir o cadastro com este e-mail. Tente entrar ou recuperar sua senha.';
  }

  if (code === 'auth/weak-password' || hay.includes('auth/weak-password')) {
    return 'A senha não atende aos requisitos mínimos de segurança.';
  }

  if (code === 'auth/too-many-requests' || hay.includes('auth/too-many-requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.';
  }

  if (code === 'auth/user-disabled' || hay.includes('auth/user-disabled')) {
    return 'Esta conta está temporariamente indisponível. Entre em contato com o atendimento.';
  }

  if (
    code === 'auth/expired-action-code' ||
    code === 'auth/invalid-action-code' ||
    hay.includes('auth/expired-action-code') ||
    hay.includes('auth/invalid-action-code')
  ) {
    return 'Este link de confirmação ou recuperação expirou ou já foi utilizado. Solicite um novo link.';
  }

  if (code === 'auth/requires-recent-login' || hay.includes('auth/requires-recent-login')) {
    return 'Por segurança, confirme sua identidade novamente antes de realizar esta alteração.';
  }

  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/account-exists-with-different-credential' ||
    code === 'auth/provider-already-linked'
  ) {
    return 'Este método de acesso já está vinculado a uma conta. Faça login pelo método original para gerenciar vínculos com segurança.';
  }

  if (code === 'auth/operation-not-allowed' || hay.includes('auth/operation-not-allowed')) {
    return 'O login com E-mail e Senha ainda não foi ativado no Firebase Console (Authentication > Sign-in method > Email/Password).';
  }

  if (code === 'auth/popup-blocked' || hay.includes('auth/popup-blocked')) {
    return 'O navegador bloqueou a janela de autenticação com Google. Permita pop-ups para este site e tente novamente.';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    hay.includes('auth/popup-closed-by-user') ||
    hay.includes('auth/cancelled-popup-request')
  ) {
    return 'A autenticação com Google foi cancelada antes da conclusão.';
  }

  if (code === 'auth/network-request-failed' || hay.includes('auth/network-request-failed')) {
    return 'Falha de conexão com o serviço de autenticação. Verifique sua internet e tente novamente.';
  }

  return message || 'Não foi possível concluir a autenticação. Tente novamente.';
}
