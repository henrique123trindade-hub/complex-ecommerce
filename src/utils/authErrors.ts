export function formatFirebaseAuthError(error: unknown, hostname?: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    const cleanHost = hostname?.trim();
    if (cleanHost) {
      return `O domínio "${cleanHost}" ainda não está autorizado no Firebase Authentication. Adicione "${cleanHost}" em Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    return 'Este domínio ainda não está autorizado no Firebase Authentication. Adicione-o em Firebase Console > Authentication > Settings > Authorized domains.';
  }

  if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
    return 'O provedor de E-mail/Senha ainda não foi ativado neste projeto. Ative-o em Firebase Console > Authentication > Sign-in method > E-mail/senha.';
  }

  if (code === 'auth/email-already-in-use' || message.includes('auth/email-already-in-use')) {
    return 'Este e-mail já está cadastrado. Tente entrar com sua senha, recuperar o acesso ou continuar com o Google.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    message.includes('auth/invalid-credential') ||
    message.includes('auth/wrong-password') ||
    message.includes('auth/user-not-found')
  ) {
    return 'E-mail ou senha incorretos. Confira seus dados ou utilize "Esqueci minha senha".';
  }

  if (code === 'auth/invalid-email' || message.includes('auth/invalid-email')) {
    return 'Informe um endereço de e-mail válido.';
  }

  if (code === 'auth/weak-password' || message.includes('auth/weak-password')) {
    return 'A senha não atende aos requisitos mínimos de segurança. Use ao menos 8 caracteres com letras e números.';
  }

  if (code === 'auth/too-many-requests' || message.includes('auth/too-many-requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.';
  }

  if (code === 'auth/user-disabled' || message.includes('auth/user-disabled')) {
    return 'Esta conta está temporariamente desativada. Entre em contato com o atendimento da COMPLEX.';
  }

  if (
    code === 'auth/account-exists-with-different-credential' ||
    message.includes('auth/account-exists-with-different-credential')
  ) {
    return 'Já existe uma conta com este e-mail vinculada a outro método de acesso. Entre pelo método original.';
  }

  if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
    return 'O navegador bloqueou a janela de login com Google. Permita pop-ups para este site e tente novamente.';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    message.includes('auth/popup-closed-by-user') ||
    message.includes('auth/cancelled-popup-request')
  ) {
    return 'O login com Google foi cancelado antes da conclusão.';
  }

  if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
    return 'Falha de conexão ao autenticar. Verifique sua internet e tente novamente.';
  }

  return message || 'Não foi possível concluir a autenticação. Tente novamente.';
}
