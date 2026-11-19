import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth, useStoreUI } from '../context/StoreContext';
import type { BrazilianAddress, OrderRecord } from '../types/store';
import { formatBrl, formatCep, formatCpf, getOrderStatusLabel, validateCep } from '../utils/commerce';
import { formatFirebaseAuthError } from '../utils/authErrors';
import { lookupBrazilianCep } from '../utils/cepLookup';
import {
  sanitizeInternalRedirect,
  validateAuthDisplayName,
  validateAuthEmail,
  validatePasswordConfirmation,
  validatePasswordStrength,
} from '../utils/authValidation';

interface AccountPageProps {
  onNavigate: (path: string) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

const GoogleMark: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    <path
      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </svg>
);

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const {
    user,
    authReady,
    isAdmin,
    userProfile,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshEmailVerificationStatus,
    logout,
    saveUserProfile,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    fetchUserOrders,
    getDemoOrders,
  } = useAuth();
  const { showToast } = useStoreUI();

  const redirectTarget = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return sanitizeInternalRedirect(window.location.search);
  }, []);

  // Auth form states
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState<'email' | 'google' | 'reset' | null>(null);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Email verification banner actions (for signed-in unverified accounts)
  const [verifyBusy, setVerifyBusy] = useState<'resend' | 'refresh' | null>(null);
  const [verifyNotice, setVerifyNotice] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // Profile states
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  // Address states
  const [addresses, setAddresses] = useState<BrazilianAddress[]>([]);
  const [newAddressOpen, setNewAddressOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Casa');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrCep, setAddrCep] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const passwordCheck = useMemo(() => validatePasswordStrength(authPassword), [authPassword]);
  const isEmailVerified = Boolean(user?.emailVerified || userProfile?.emailVerified);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setCpf(userProfile.cpf || '');
      setPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!authReady) return;
    if (user) {
      fetchAddresses().then(setAddresses).catch(() => {});
      fetchUserOrders().then(setOrders).catch(() => {});
    } else {
      setOrders(getDemoOrders());
    }
  }, [authReady, user, fetchAddresses, fetchUserOrders, getDemoOrders]);

  const switchAuthMode = (nextMode: AuthMode) => {
    setAuthMode(nextMode);
    setAuthError('');
    setAuthSuccess('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const completePostAuthRedirect = () => {
    if (redirectTarget) {
      onNavigate(redirectTarget);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthSuccess('');
    setAuthBusy('google');
    try {
      await signInWithGoogle();
      showToast('Acesso com Google realizado.');
      completePostAuthRedirect();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const emailResult = validateAuthEmail(authEmail);
    if (!emailResult.valid) {
      setAuthError(emailResult.message || 'Informe um e-mail válido.');
      return;
    }
    if (!authPassword) {
      setAuthError('Informe sua senha para entrar.');
      return;
    }

    setAuthBusy('email');
    try {
      await signInWithEmail({ email: authEmail, password: authPassword });
      setAuthPassword('');
      showToast('Bem-vindo de volta à COMPLEX.');
      completePostAuthRedirect();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const nameResult = validateAuthDisplayName(authName);
    if (!nameResult.valid) {
      setAuthError(nameResult.message || 'Informe seu nome completo.');
      return;
    }

    const emailResult = validateAuthEmail(authEmail);
    if (!emailResult.valid) {
      setAuthError(emailResult.message || 'Informe um e-mail válido.');
      return;
    }

    const strength = validatePasswordStrength(authPassword);
    if (!strength.valid) {
      setAuthError(strength.message || 'Defina uma senha mais forte.');
      return;
    }

    const confirmResult = validatePasswordConfirmation(authPassword, authConfirmPassword);
    if (!confirmResult.valid) {
      setAuthError(confirmResult.message || 'As senhas não coincidem.');
      return;
    }

    setAuthBusy('email');
    try {
      const { verificationEmailSent } = await signUpWithEmail({
        displayName: authName,
        email: authEmail,
        password: authPassword,
      });
      setAuthPassword('');
      setAuthConfirmPassword('');
      if (verificationEmailSent) {
        setVerifyNotice(
          `Enviamos um link de confirmação para ${authEmail.trim().toLowerCase()}. Verifique sua caixa de entrada ou spam.`
        );
        showToast('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      } else {
        showToast('Conta criada na COMPLEX.');
      }
      completePostAuthRedirect();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthBusy(null);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const emailResult = validateAuthEmail(authEmail);
    if (!emailResult.valid) {
      setAuthError(emailResult.message || 'Informe um e-mail válido.');
      return;
    }

    setAuthBusy('reset');
    try {
      await sendPasswordReset(authEmail);
      setAuthSuccess(
        `Se existir uma conta com o e-mail ${authEmail.trim().toLowerCase()}, enviamos um link para redefinir sua senha. Confira também a caixa de spam.`
      );
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleResendVerification = async () => {
    setVerifyError('');
    setVerifyNotice('');
    setVerifyBusy('resend');
    try {
      await resendVerificationEmail();
      setVerifyNotice(
        'Novo e-mail de confirmação enviado. Verifique sua caixa de entrada e clique no link para validar.'
      );
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setVerifyError(formatFirebaseAuthError(err, host));
    } finally {
      setVerifyBusy(null);
    }
  };

  const handleRefreshVerification = async () => {
    setVerifyError('');
    setVerifyNotice('');
    setVerifyBusy('refresh');
    try {
      const verified = await refreshEmailVerificationStatus();
      if (verified) {
        showToast('E-mail confirmado com sucesso.');
      } else {
        setVerifyNotice(
          'Ainda não detectamos a confirmação. Clique no link enviado para o seu e-mail e tente novamente.'
        );
      }
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setVerifyError(formatFirebaseAuthError(err, host));
    } finally {
      setVerifyBusy(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUserProfile({ displayName, cpf, phone });
  };

  const addrCepSeqRef = useRef(0);

  const handleAddressCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setAddrCep(formatted);
    if (!validateCep(formatted)) {
      addrCepSeqRef.current += 1;
      return;
    }
    const seq = ++addrCepSeqRef.current;
    const result = await lookupBrazilianCep(formatted);
    if (seq !== addrCepSeqRef.current) return;
    if (result.status === 'found') {
      setAddrStreet(result.data.street);
      setAddrNeighborhood(result.data.neighborhood);
      setAddrCity(result.data.city);
      setAddrState(result.data.state);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `addr-${Date.now()}`;
    await saveAddress({
      id,
      label: addrLabel || 'Principal',
      recipientName: addrRecipient || displayName || 'Destinatário',
      cep: addrCep,
      street: addrStreet,
      number: addrNumber,
      neighborhood: addrNeighborhood,
      city: addrCity,
      state: addrState.toUpperCase().slice(0, 2),
      isDefault: addresses.length === 0,
    });
    const updated = await fetchAddresses();
    setAddresses(updated);
    setNewAddressOpen(false);
    setAddrCep('');
    setAddrStreet('');
    setAddrNumber('');
    setAddrNeighborhood('');
    setAddrCity('');
    setAddrState('');
    showToast('Endereço salvo na sua conta.');
  };

  const handleRemoveAddress = async (id: string) => {
    await deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  if (!authReady) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-24 text-center font-mono-tabular text-xs uppercase">
        Carregando conta...
      </main>
    );
  }

  const pageHeading = user
    ? `Olá, ${userProfile?.displayName || user.displayName || 'Cliente'}`
    : authMode === 'register'
      ? 'Criar Conta'
      : authMode === 'reset'
        ? 'Recuperar Senha'
        : 'Entrar na Conta';

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="pb-8 border-b border-[#171717]/12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              ÁREA DO CLIENTE
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em]">
              {pageHeading}
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="px-4 py-2 border border-[#6A705C] text-[#6A705C] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#6A705C]/10 transition-colors cursor-pointer"
                >
                  Acessar Painel Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#171717]/25 font-mono-tabular text-xs uppercase tracking-[0.12em] hover:border-[#171717] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-10">
            <div className="lg:col-span-5 space-y-6">
              {redirectTarget === '/checkout' && (
                <div className="border border-[#171717]/15 bg-[#EAE6DF]/55 px-4 py-3 text-xs text-[#171717]/80 flex items-center justify-between gap-3">
                  <span>Entre ou crie sua conta para voltar automaticamente ao checkout com sua sacola preservada.</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/checkout')}
                    className="font-mono-tabular text-[11px] uppercase underline underline-offset-4 shrink-0 cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              )}

              <div className="border border-[#171717]/15 p-6 sm:p-8 bg-[#EAE6DF]/45 space-y-6">
                {/* LOGIN MODE */}
                {authMode === 'login' && (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Acesse sua conta COMPLEX
                      </h2>
                      <p className="text-xs leading-relaxed text-[#171717]/70">
                        Use seu e-mail e senha ou continue com sua conta Google para acompanhar pedidos e endereços.
                      </p>
                    </div>

                    <form onSubmit={handleEmailLogin} noValidate className="space-y-4">
                      <div>
                        <label htmlFor="auth-login-email" className="block text-xs mb-1.5">
                          E-mail
                        </label>
                        <input
                          id="auth-login-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="auth-login-password" className="block text-xs">
                            Senha
                          </label>
                          <button
                            type="button"
                            onClick={() => switchAuthMode('reset')}
                            className="font-mono-tabular text-[11px] text-[#171717]/75 underline underline-offset-4 hover:text-[#171717] transition-colors cursor-pointer"
                          >
                            Esqueci minha senha
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            id="auth-login-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="Sua senha"
                            className="w-full h-11 pl-3.5 pr-11 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            className="absolute right-0 top-0 h-11 w-11 inline-flex items-center justify-center text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {authError && (
                        <p role="alert" className="text-xs text-[#8A2C2C] leading-relaxed">
                          {authError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={authBusy !== null}
                        className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-55 cursor-pointer"
                      >
                        {authBusy === 'email' ? 'Entrando...' : 'Entrar'}
                      </button>
                    </form>

                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-[#171717]/12" />
                      <span className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
                        ou
                      </span>
                      <span className="h-px flex-1 bg-[#171717]/12" />
                    </div>

                    <button
                      type="button"
                      disabled={authBusy !== null}
                      onClick={() => void handleGoogleSignIn()}
                      className="w-full h-12 border border-[#171717]/25 bg-[#F1EEE8] text-[#171717] font-mono-tabular text-xs uppercase tracking-[0.12em] inline-flex items-center justify-center gap-2.5 hover:border-[#171717] active:scale-[0.99] transition-[border-color,transform] duration-200 disabled:opacity-55 cursor-pointer"
                    >
                      <GoogleMark />
                      <span>{authBusy === 'google' ? 'Conectando...' : 'Continuar com Google'}</span>
                    </button>

                    <p className="text-xs text-center text-[#171717]/75 pt-2 border-t border-[#171717]/10">
                      Não tem uma conta?{' '}
                      <button
                        type="button"
                        onClick={() => switchAuthMode('register')}
                        className="font-medium text-[#171717] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                      >
                        Cadastre-se
                      </button>
                    </p>
                  </>
                )}

                {/* REGISTER MODE */}
                {authMode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Crie sua conta COMPLEX
                      </h2>
                      <p className="text-xs leading-relaxed text-[#171717]/70">
                        Salve seus endereços, acompanhe pedidos e finalize compras com mais agilidade.
                      </p>
                    </div>

                    <form onSubmit={handleEmailRegister} noValidate className="space-y-4">
                      <div>
                        <label htmlFor="auth-reg-name" className="block text-xs mb-1.5">
                          Nome completo
                        </label>
                        <input
                          id="auth-reg-name"
                          type="text"
                          autoComplete="name"
                          required
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                        />
                      </div>

                      <div>
                        <label htmlFor="auth-reg-email" className="block text-xs mb-1.5">
                          E-mail
                        </label>
                        <input
                          id="auth-reg-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                        />
                      </div>

                      <div>
                        <label htmlFor="auth-reg-password" className="block text-xs mb-1.5">
                          Senha
                        </label>
                        <div className="relative">
                          <input
                            id="auth-reg-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            className="w-full h-11 pl-3.5 pr-11 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            className="absolute right-0 top-0 h-11 w-11 inline-flex items-center justify-center text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 font-mono-tabular text-[11px]">
                          <span
                            className={
                              passwordCheck.checks.minLength
                                ? 'text-[#6A705C]'
                                : 'text-[#99968F]'
                            }
                          >
                            {passwordCheck.checks.minLength ? '✓' : '·'} 8+ caracteres
                          </span>
                          <span
                            className={
                              passwordCheck.checks.hasUpper
                                ? 'text-[#6A705C]'
                                : 'text-[#99968F]'
                            }
                          >
                            {passwordCheck.checks.hasUpper ? '✓' : '·'} Maiúscula
                          </span>
                          <span
                            className={
                              passwordCheck.checks.hasLower
                                ? 'text-[#6A705C]'
                                : 'text-[#99968F]'
                            }
                          >
                            {passwordCheck.checks.hasLower ? '✓' : '·'} Minúscula
                          </span>
                          <span
                            className={
                              passwordCheck.checks.hasNumber
                                ? 'text-[#6A705C]'
                                : 'text-[#99968F]'
                            }
                          >
                            {passwordCheck.checks.hasNumber ? '✓' : '·'} Número
                          </span>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="auth-reg-confirm" className="block text-xs mb-1.5">
                          Confirmar senha
                        </label>
                        <div className="relative">
                          <input
                            id="auth-reg-confirm"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={authConfirmPassword}
                            onChange={(e) => setAuthConfirmPassword(e.target.value)}
                            placeholder="Repita sua senha"
                            className="w-full h-11 pl-3.5 pr-11 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            aria-label={
                              showConfirmPassword
                                ? 'Ocultar confirmação de senha'
                                : 'Mostrar confirmação de senha'
                            }
                            className="absolute right-0 top-0 h-11 w-11 inline-flex items-center justify-center text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {authError && (
                        <p role="alert" className="text-xs text-[#8A2C2C] leading-relaxed">
                          {authError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={authBusy !== null}
                        className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-55 cursor-pointer"
                      >
                        {authBusy === 'email' ? 'Criando conta...' : 'Criar minha conta'}
                      </button>
                    </form>

                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-[#171717]/12" />
                      <span className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
                        ou
                      </span>
                      <span className="h-px flex-1 bg-[#171717]/12" />
                    </div>

                    <button
                      type="button"
                      disabled={authBusy !== null}
                      onClick={() => void handleGoogleSignIn()}
                      className="w-full h-12 border border-[#171717]/25 bg-[#F1EEE8] text-[#171717] font-mono-tabular text-xs uppercase tracking-[0.12em] inline-flex items-center justify-center gap-2.5 hover:border-[#171717] active:scale-[0.99] transition-[border-color,transform] duration-200 disabled:opacity-55 cursor-pointer"
                    >
                      <GoogleMark />
                      <span>{authBusy === 'google' ? 'Conectando...' : 'Continuar com Google'}</span>
                    </button>

                    <p className="text-xs text-center text-[#171717]/75 pt-2 border-t border-[#171717]/10">
                      Já tem uma conta?{' '}
                      <button
                        type="button"
                        onClick={() => switchAuthMode('login')}
                        className="font-medium text-[#171717] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                      >
                        Entrar
                      </button>
                    </p>
                  </>
                )}

                {/* PASSWORD RESET MODE */}
                {authMode === 'reset' && (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Redefinir sua senha
                      </h2>
                      <p className="text-xs leading-relaxed text-[#171717]/70">
                        Informe o e-mail cadastrado na sua conta COMPLEX. Enviaremos um link seguro para você criar uma nova senha.
                      </p>
                    </div>

                    <form onSubmit={handlePasswordReset} noValidate className="space-y-4">
                      <div>
                        <label htmlFor="auth-reset-email" className="block text-xs mb-1.5">
                          E-mail cadastrado
                        </label>
                        <input
                          id="auth-reset-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                        />
                      </div>

                      {authError && (
                        <p role="alert" className="text-xs text-[#8A2C2C] leading-relaxed">
                          {authError}
                        </p>
                      )}

                      {authSuccess && (
                        <div className="border border-[#6A705C] bg-[#6A705C]/10 p-3.5 text-xs text-[#171717] flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#6A705C] shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{authSuccess}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authBusy !== null}
                        className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-55 cursor-pointer"
                      >
                        {authBusy === 'reset' ? 'Enviando link...' : 'Enviar link de recuperação'}
                      </button>
                    </form>

                    <p className="text-xs text-center text-[#171717]/75 pt-2 border-t border-[#171717]/10">
                      Lembrou sua senha?{' '}
                      <button
                        type="button"
                        onClick={() => switchAuthMode('login')}
                        className="font-medium text-[#171717] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                      >
                        Voltar para entrar
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                Pedidos de Demonstração Nesta Sessão ({orders.length})
              </h2>
              {orders.length === 0 ? (
                <p className="text-sm text-[#171717]/70 py-6 border-t border-[#171717]/10">
                  Nenhum pedido registrado nesta sessão ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <div key={ord.id} className="border border-[#171717]/15 p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono-tabular text-sm font-medium">{ord.orderNumber}</p>
                        <p className="text-xs text-[#99968F]">
                          {getOrderStatusLabel(ord.status)} · {ord.items.length}{' '}
                          {ord.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm font-medium">
                        {formatBrl(ord.totalBrl)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8 pt-8">
            {!isEmailVerified && (
              <div className="border border-[#171717]/20 bg-[#EAE6DF]/60 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-mono-tabular uppercase tracking-[0.12em] font-medium">
                      Confirme seu e-mail para proteger sua conta
                    </p>
                    <p className="text-[#171717]/75 leading-relaxed">
                      Enviamos um link de verificação para{' '}
                      <span className="font-mono-tabular text-[#171717]">{user.email}</span>. Você já pode navegar, salvar endereços e acompanhar pedidos normalmente.
                    </p>
                    {verifyNotice && <p className="text-[#6A705C] pt-1">{verifyNotice}</p>}
                    {verifyError && <p className="text-[#8A2C2C] pt-1">{verifyError}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={verifyBusy !== null}
                    onClick={() => void handleResendVerification()}
                    className="px-3.5 py-2 border border-[#171717]/25 bg-[#F1EEE8] font-mono-tabular text-[11px] uppercase tracking-[0.1em] hover:border-[#171717] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {verifyBusy === 'resend' ? 'Enviando...' : 'Reenviar e-mail'}
                  </button>
                  <button
                    type="button"
                    disabled={verifyBusy !== null}
                    onClick={() => void handleRefreshVerification()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase tracking-[0.1em] hover:bg-[#171717]/88 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${verifyBusy === 'refresh' ? 'animate-spin' : ''}`}
                    />
                    <span>Já confirmei</span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Profile & Addresses */}
              <div className="lg:col-span-5 space-y-8">
                <form onSubmit={handleSaveProfile} className="border border-[#171717]/15 p-6 space-y-4">
                  <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                    Perfil do Cliente
                  </h2>
                  <div>
                    <label htmlFor="acc-name" className="block text-xs mb-1">Nome</label>
                    <input
                      id="acc-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="acc-email" className="block text-xs mb-1">E-mail</label>
                    <input
                      id="acc-email"
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full h-10 px-3 bg-[#EAE6DF]/60 border border-[#171717]/15 text-sm text-[#99968F]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="acc-cpf" className="block text-xs mb-1">CPF</label>
                      <input
                        id="acc-cpf"
                        type="text"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717] transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-phone" className="block text-xs mb-1">Telefone</label>
                      <input
                        id="acc-phone"
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717] transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
                  >
                    Salvar Perfil
                  </button>
                </form>

                {/* Saved Addresses */}
                <div className="border border-[#171717]/15 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Endereços Salvos ({addresses.length})</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setNewAddressOpen((v) => !v)}
                      aria-expanded={newAddressOpen}
                      className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                    >
                      <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${newAddressOpen ? 'rotate-45' : ''}`} />
                      <span>{newAddressOpen ? 'Fechar' : 'Adicionar'}</span>
                    </button>
                  </div>

                  <div className="accordion-panel" data-open={newAddressOpen ? 'true' : 'false'}>
                    <div>
                      <form onSubmit={handleAddAddress} className="space-y-3 pt-2 border-t border-[#171717]/10">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Etiqueta (Casa, Trabalho)"
                            value={addrLabel}
                            onChange={(e) => setAddrLabel(e.target.value)}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                          />
                          <input
                            type="text"
                            required
                            placeholder="CEP"
                            value={addrCep}
                            onChange={(e) => void handleAddressCepChange(e.target.value)}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
                          />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Destinatário"
                          value={addrRecipient}
                          onChange={(e) => setAddrRecipient(e.target.value)}
                          className="w-full h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Rua / Av."
                            value={addrStreet}
                            onChange={(e) => setAddrStreet(e.target.value)}
                            className="col-span-2 h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Nº"
                            value={addrNumber}
                            onChange={(e) => setAddrNumber(e.target.value)}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Bairro"
                            value={addrNeighborhood}
                            onChange={(e) => setAddrNeighborhood(e.target.value)}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Cidade"
                            value={addrCity}
                            onChange={(e) => setAddrCity(e.target.value)}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                          />
                          <input
                            type="text"
                            required
                            maxLength={2}
                            placeholder="UF"
                            value={addrState}
                            onChange={(e) => setAddrState(e.target.value.toUpperCase())}
                            className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs uppercase focus:outline-none focus:border-[#171717]"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase hover:bg-[#171717]/88 transition-colors cursor-pointer"
                        >
                          Salvar Endereço
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="p-3 bg-[#EAE6DF]/55 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <p className="font-mono-tabular uppercase tracking-[0.08em] font-medium">
                            {addr.label}
                          </p>
                          <p className="mt-0.5">
                            {addr.street}, {addr.number} — {addr.neighborhood}
                          </p>
                          <p className="text-[#99968F]">
                            {addr.city}/{addr.state} · CEP {addr.cep}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveAddress(addr.id)}
                          aria-label={`Remover endereço ${addr.label}`}
                          className="text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {addresses.length === 0 && !newAddressOpen && (
                      <p className="text-xs text-[#99968F]">Nenhum endereço salvo.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order History */}
              <div className="lg:col-span-7 space-y-4">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span>Histórico de Pedidos ({orders.length})</span>
                </h2>

                {orders.length === 0 ? (
                  <div className="border border-[#171717]/15 p-10 text-center space-y-3">
                    <p className="text-sm text-[#171717]/75">Você ainda não realizou pedidos.</p>
                    <button
                      type="button"
                      onClick={() => onNavigate('/shop')}
                      className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
                    >
                      Explorar catálogo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => {
                      const isOpen = selectedOrderId === ord.id;
                      return (
                        <div key={ord.id} className="border border-[#171717]/15 p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono-tabular text-sm font-medium">
                                {ord.orderNumber}
                              </span>
                              <span className="ml-3 font-mono-tabular text-[11px] uppercase text-[#99968F]">
                                {getOrderStatusLabel(ord.status)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-mono-tabular text-sm font-medium">
                                {formatBrl(ord.totalBrl)}
                              </span>
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() => setSelectedOrderId(isOpen ? null : ord.id)}
                                className="font-mono-tabular text-[11px] uppercase underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                              >
                                {isOpen ? 'Ocultar' : 'Detalhes'}
                              </button>
                            </div>
                          </div>

                          <div className="accordion-panel" data-open={isOpen ? 'true' : 'false'}>
                            <div>
                              <div className="pt-3 mt-3 border-t border-[#171717]/10 space-y-2 text-xs">
                                {ord.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>
                                      {it.quantity}x {it.name} ({it.colorName}, Tam {it.size})
                                    </span>
                                    <span className="font-mono-tabular">
                                      {formatBrl(it.unitPriceBrl * it.quantity)}
                                    </span>
                                  </div>
                                ))}
                                <p className="text-[#99968F] pt-1">
                                  Entrega: {ord.shippingAddress.street}, {ord.shippingAddress.number} —{' '}
                                  {ord.shippingAddress.city}/{ord.shippingAddress.state}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
