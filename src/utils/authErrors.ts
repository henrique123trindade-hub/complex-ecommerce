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
    return 'Falha de conexão ao autenticar com o Google. Verifique sua internet e tente novamente.';
  }

  return message || 'Não foi possível concluir o login com Google.';
}
