import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LogOut,
  MailCheck,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { BrazilianAddress, OrderRecord } from '../types/store';
import { formatBrl, formatCep, formatCpf } from '../utils/commerce';
import { formatFirebaseAuthError } from '../utils/authErrors';
import {
  validateAuthEmail,
  validateAuthName,
  validatePasswordMatch,
  validatePasswordStrength,
} from '../utils/authValidation';

interface AccountPageProps {
  onNavigate: (path: string) => void;
}

type AuthFormMode = 'login' | 'register' | 'reset';

const PasswordPolicyList: React.FC<{ password: string }> = ({ password }) => {
  const { checks } = useMemo(() => validatePasswordStrength(password), [password]);
  const items = [
    { label: 'Mínimo de 8 caracteres', ok: checks.minLength },
    { label: 'Pelo menos uma letra maiúscula', ok: checks.hasUppercase },
    { label: 'Pelo menos uma letra minúscula', ok: checks.hasLowercase },
    { label: 'Pelo menos um número', ok: checks.hasDigit },
  ];

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
      {items.map((item) => (
        <li
          key={item.label}
          className={`flex items-center gap-1.5 font-mono-tabular text-[11px] ${
            item.ok ? 'text-[#6A705C]' : 'text-[#99968F]'
          }`}
        >
          <Check className={`w-3 h-3 shrink-0 ${item.ok ? 'opacity-100' : 'opacity-30'}`} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
};

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const {
    user,
    authReady,
    isAdmin,
    userProfile,
    signInWithGoogle,
    registerWithEmail,
    signInWithEmail,
    requestPasswordReset,
    resendVerificationEmail,
    refreshEmailVerification,
    inspectPasswordResetCode,
    confirmResetPasswordWithCode,
    applyEmailVerificationCode,
    linkGoogleAccount,
    linkPasswordCredential,
    changeUserPassword,
    logout,
    saveUserProfile,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    fetchUserOrders,
    getDemoOrders,
    showToast,
  } = useStore();

  // Auth mode & forms
  const [authMode, setAuthMode] = useState<AuthFormMode>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmittedMessage, setResetSubmittedMessage] = useState('');

  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  // Action code handling (?mode=resetPassword&oobCode=... / ?mode=verifyEmail&oobCode=...)
  const [actionMode, setActionMode] = useState<'none' | 'resetPassword' | 'verifyEmail'>('none');
  const [actionCode, setActionCode] = useState('');
  const [actionEmailTarget, setActionEmailTarget] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmNewResetPassword, setConfirmNewResetPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);

  // Email verification gate state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState('');

  // Account linking & password change state
  const [securityPanelOpen, setSecurityPanelOpen] = useState<'none' | 'linkGoogle' | 'linkPassword' | 'changePassword'>('none');
  const [linkCurrentPassword, setLinkCurrentPassword] = useState('');
  const [linkNewPassword, setLinkNewPassword] = useState('');
  const [linkConfirmPassword, setLinkConfirmPassword] = useState('');
  const [changeCurrentPassword, setChangeCurrentPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');

  // Profile, addresses, orders
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

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
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Inspect Firebase action codes from query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (!oobCode || (mode !== 'resetPassword' && mode !== 'verifyEmail')) return;

    setActionCode(oobCode);
    setActionError('');
    setActionSuccess('');

    if (mode === 'verifyEmail') {
      setActionMode('verifyEmail');
      setActionLoading(true);
      applyEmailVerificationCode(oobCode)
        .then(() => {
          setActionSuccess('E-mail confirmado com sucesso. Sua conta COMPLEX está ativa.');
          window.history.replaceState({}, '', '/account');
        })
        .catch((err) => {
          const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
          setActionError(formatFirebaseAuthError(err, host));
        })
        .finally(() => setActionLoading(false));
    } else if (mode === 'resetPassword') {
      setActionMode('resetPassword');
      setActionLoading(true);
      inspectPasswordResetCode(oobCode)
        .then((targetEmail) => {
          setActionEmailTarget(targetEmail);
        })
        .catch((err) => {
          const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
          setActionError(formatFirebaseAuthError(err, host));
        })
        .finally(() => setActionLoading(false));
    }
  }, [applyEmailVerificationCode, inspectPasswordResetCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setCpf(userProfile.cpf || '');
      setPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!authReady) return;
    if (user && user.emailVerified) {
      fetchAddresses().then(setAddresses).catch(() => {});
      fetchUserOrders().then(setOrders).catch(() => {});
    } else if (!user) {
      setOrders(getDemoOrders());
    } else {
      setAddresses([]);
      setOrders([]);
    }
  }, [authReady, user, fetchAddresses, fetchUserOrders, getDemoOrders]);

  const authMethods = useMemo(() => {
    if (userProfile?.authMethods?.length) return userProfile.authMethods;
    if (!user?.providerData) return [];
    return Array.from(new Set(user.providerData.map((p) => p.providerId).filter(Boolean)));
  }, [user, userProfile]);

  const hasPasswordProvider = authMethods.includes('password');
  const hasGoogleProvider = authMethods.includes('google.com');

  const switchAuthMode = (next: AuthFormMode) => {
    setAuthMode(next);
    setAuthError('');
    setAuthNotice('');
    setResetSubmittedMessage('');
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthNotice('');
    setAuthSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const emailCheck = validateAuthEmail(loginEmail);
    if (!emailCheck.valid) {
      setAuthError(emailCheck.message || 'Informe um e-mail válido.');
      return;
    }
    if (!loginPassword) {
      setAuthError('Informe sua senha.');
      return;
    }

    setAuthSubmitting(true);
    try {
      await signInWithEmail({ email: emailCheck.normalized, password: loginPassword });
      setLoginPassword('');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const nameCheck = validateAuthName(registerName);
    if (!nameCheck.valid) {
      setAuthError(nameCheck.message || 'Nome inválido.');
      return;
    }
    const emailCheck = validateAuthEmail(registerEmail);
    if (!emailCheck.valid) {
      setAuthError(emailCheck.message || 'E-mail inválido.');
      return;
    }
    const strength = validatePasswordStrength(registerPassword);
    if (!strength.valid) {
      setAuthError(strength.errors[0]);
      return;
    }
    const match = validatePasswordMatch(registerPassword, registerConfirmPassword);
    if (!match.valid) {
      setAuthError(match.message || 'As senhas não coincidem.');
      return;
    }

    setAuthSubmitting(true);
    try {
      await registerWithEmail({
        name: nameCheck.normalized,
        email: emailCheck.normalized,
        password: registerPassword,
      });
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      showToast('Cadastro realizado. Verifique seu e-mail para ativar a conta.');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setResetSubmittedMessage('');

    const emailCheck = validateAuthEmail(resetEmail);
    if (!emailCheck.valid) {
      setAuthError(emailCheck.message || 'Informe um e-mail válido.');
      return;
    }

    setAuthSubmitting(true);
    try {
      await requestPasswordReset(emailCheck.normalized);
      setResetSubmittedMessage(
        'Se existir uma conta cadastrada com este e-mail, enviaremos um link para redefinição de senha em instantes.'
      );
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleConfirmPasswordResetAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const strength = validatePasswordStrength(newResetPassword);
    if (!strength.valid) {
      setActionError(strength.errors[0]);
      return;
    }
    const match = validatePasswordMatch(newResetPassword, confirmNewResetPassword);
    if (!match.valid) {
      setActionError(match.message || 'As senhas não coincidem.');
      return;
    }

    setActionLoading(true);
    try {
      await confirmResetPasswordWithCode(actionCode, newResetPassword);
      setActionSuccess('Senha redefinida com sucesso. Você já pode acessar sua conta.');
      setNewResetPassword('');
      setConfirmNewResetPassword('');
      window.history.replaceState({}, '', '/account');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setActionError(formatFirebaseAuthError(err, host));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setVerificationBusy(true);
    setVerificationFeedback('');
    try {
      await resendVerificationEmail();
      setResendCooldown(60);
      setVerificationFeedback('Novo e-mail de confirmação enviado. Verifique sua caixa de entrada e spam.');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setVerificationFeedback(formatFirebaseAuthError(err, host));
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerificationBusy(true);
    setVerificationFeedback('');
    try {
      const verified = await refreshEmailVerification();
      if (verified) {
        showToast('E-mail verificado com sucesso.');
      } else {
        setVerificationFeedback('Ainda não identificamos a confirmação. Clique no link recebido por e-mail e tente novamente.');
      }
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setVerificationFeedback(formatFirebaseAuthError(err, host));
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleLinkGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');
    setSecurityBusy(true);
    try {
      await linkGoogleAccount(linkCurrentPassword);
      setLinkCurrentPassword('');
      setSecurityPanelOpen('none');
      setSecuritySuccess('Conta Google vinculada com segurança ao seu perfil.');
      showToast('Conta Google vinculada.');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setSecurityError(formatFirebaseAuthError(err, host));
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleLinkPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');
    const strength = validatePasswordStrength(linkNewPassword);
    if (!strength.valid) {
      setSecurityError(strength.errors[0]);
      return;
    }
    const match = validatePasswordMatch(linkNewPassword, linkConfirmPassword);
    if (!match.valid) {
      setSecurityError(match.message || 'As senhas não coincidem.');
      return;
    }

    setSecurityBusy(true);
    try {
      await linkPasswordCredential(linkNewPassword);
      setLinkNewPassword('');
      setLinkConfirmPassword('');
      setSecurityPanelOpen('none');
      setSecuritySuccess('Senha adicionada à sua conta com reautenticação verificada.');
      showToast('Login por e-mail e senha ativado.');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setSecurityError(formatFirebaseAuthError(err, host));
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');
    if (!changeCurrentPassword) {
      setSecurityError('Informe sua senha atual.');
      return;
    }
    const strength = validatePasswordStrength(changeNewPassword);
    if (!strength.valid) {
      setSecurityError(strength.errors[0]);
      return;
    }
    const match = validatePasswordMatch(changeNewPassword, changeConfirmPassword);
    if (!match.valid) {
      setSecurityError(match.message || 'As senhas não coincidem.');
      return;
    }

    setSecurityBusy(true);
    try {
      await changeUserPassword(changeCurrentPassword, changeNewPassword);
      setChangeCurrentPassword('');
      setChangeNewPassword('');
      setChangeConfirmPassword('');
      setSecurityPanelOpen('none');
      setSecuritySuccess('Sua senha foi atualizada com sucesso.');
      showToast('Senha atualizada.');
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setSecurityError(formatFirebaseAuthError(err, host));
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUserProfile({ displayName, cpf, phone });
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
    setAddrStreet('');
    setAddrNumber('');
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

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="pb-8 border-b border-[#171717]/12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              ÁREA DO CLIENTE
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em]">
              {user
                ? `Olá, ${userProfile?.displayName || user.displayName || 'Cliente'}`
                : 'Entrar ou Criar Conta'}
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              {user.emailVerified && isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="px-4 py-2 border border-[#6A705C] text-[#6A705C] hover:bg-[#6A705C]/10 font-mono-tabular text-xs uppercase tracking-[0.12em] transition-colors cursor-pointer"
                >
                  Painel Administrativo
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

        {/* Action code resolution banner/panel (reset password / email verify link) */}
        {actionMode === 'verifyEmail' && (
          <div className="mt-8 border border-[#171717]/20 bg-[#EAE6DF]/70 p-6 space-y-3">
            <p className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
              VERIFICAÇÃO DE E-MAIL
            </p>
            {actionLoading && <p className="text-sm">Validando código de confirmação...</p>}
            {actionSuccess && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-[#6A705C] inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setActionMode('none')}
                  className="font-mono-tabular text-xs uppercase underline cursor-pointer"
                >
                  Continuar
                </button>
              </div>
            )}
            {actionError && (
              <div className="space-y-2">
                <p className="text-sm text-[#8A2C2C]">{actionError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setActionMode('none');
                    window.history.replaceState({}, '', '/account');
                  }}
                  className="font-mono-tabular text-xs uppercase underline cursor-pointer"
                >
                  Voltar ao acesso
                </button>
              </div>
            )}
          </div>
        )}

        {actionMode === 'resetPassword' && (
          <div className="mt-8 max-w-lg border border-[#171717]/20 bg-[#EAE6DF]/60 p-8 space-y-5">
            <div className="space-y-1">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
                REDEFINIÇÃO DE SENHA
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Definir nova senha
              </h2>
              {actionEmailTarget && (
                <p className="text-xs text-[#171717]/75">
                  Conta: <span className="font-mono-tabular">{actionEmailTarget}</span>
                </p>
              )}
            </div>

            {actionLoading && !actionEmailTarget && !actionError ? (
              <p className="text-sm">Validando link de recuperação...</p>
            ) : actionSuccess ? (
              <div className="space-y-4">
                <p className="text-sm text-[#6A705C] inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMode('none');
                      switchAuthMode('login');
                    }}
                    className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
                  >
                    Entrar com a nova senha
                  </button>
                </div>
              </div>
            ) : actionError && !actionEmailTarget ? (
              <div className="space-y-4">
                <p className="text-sm text-[#8A2C2C]">{actionError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setActionMode('none');
                    window.history.replaceState({}, '', '/account');
                    switchAuthMode('reset');
                  }}
                  className="px-5 py-2.5 border border-[#171717] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
                >
                  Solicitar novo link
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmPasswordResetAction} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-new-pwd" className="block text-xs mb-1.5">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-pwd"
                      type={showResetNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      className="w-full h-11 pl-3 pr-10 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword((v) => !v)}
                      aria-label="Mostrar ou ocultar senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99968F] hover:text-[#171717] cursor-pointer"
                    >
                      {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordPolicyList password={newResetPassword} />
                </div>

                <div>
                  <label htmlFor="reset-confirm-pwd" className="block text-xs mb-1.5">
                    Confirmar nova senha
                  </label>
                  <input
                    id="reset-confirm-pwd"
                    type={showResetNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmNewResetPassword}
                    onChange={(e) => setConfirmNewResetPassword(e.target.value)}
                    className="w-full h-11 px-3 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                  />
                </div>

                {actionError && (
                  <p role="alert" className="text-xs text-[#8A2C2C]">
                    {actionError}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Salvando...' : 'Atualizar Senha'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMode('none');
                      window.history.replaceState({}, '', '/account');
                    }}
                    className="font-mono-tabular text-xs uppercase underline text-[#99968F] cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Unauthenticated Sign-In / Sign-Up / Recovery */}
        {!user && actionMode !== 'resetPassword' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-10">
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-[#171717]/15 bg-[#EAE6DF]/45 p-6 sm:p-8 space-y-6">
                {/* Mode tabs */}
                <div className="grid grid-cols-3 border border-[#171717]/20 bg-[#F1EEE8]">
                  {(
                    [
                      ['login', 'Entrar'],
                      ['register', 'Criar Conta'],
                      ['reset', 'Recuperar'],
                    ] as const
                  ).map(([modeId, label]) => (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => switchAuthMode(modeId)}
                      className={`h-10 font-mono-tabular text-[11px] uppercase tracking-[0.1em] transition-colors cursor-pointer ${
                        authMode === modeId
                          ? 'bg-[#171717] text-[#F1EEE8]'
                          : 'text-[#171717]/75 hover:text-[#171717]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {authMode === 'login' && (
                  <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Acesse sua conta COMPLEX
                      </h2>
                      <p className="text-xs text-[#171717]/75">
                        Entre com seu e-mail cadastrado ou utilize sua Conta Google.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="auth-login-email" className="block text-xs mb-1.5">
                        E-mail
                      </label>
                      <input
                        id="auth-login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
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
                          className="font-mono-tabular text-[11px] uppercase tracking-[0.06em] text-[#99968F] hover:text-[#171717] underline underline-offset-4 cursor-pointer"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="auth-login-password"
                          type={showLoginPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Sua senha"
                          className="w-full h-11 pl-3.5 pr-10 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99968F] hover:text-[#171717] cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div role="alert" className="border border-[#8A2C2C]/35 bg-[#8A2C2C]/5 p-3 flex items-start gap-2 text-xs text-[#8A2C2C]">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/90 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {authSubmitting ? 'Entrando...' : 'Entrar com E-mail'}
                    </button>
                  </form>
                )}

                {authMode === 'register' && (
                  <form onSubmit={handleEmailRegister} className="space-y-4" noValidate>
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Criar conta de cliente
                      </h2>
                      <p className="text-xs text-[#171717]/75">
                        Cadastre-se para acompanhar pedidos e salvar seus endereços de entrega.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="auth-reg-name" className="block text-xs mb-1.5">
                        Nome completo
                      </label>
                      <input
                        id="auth-reg-name"
                        type="text"
                        autoComplete="name"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        placeholder="Como devemos te chamar"
                        className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
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
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                      />
                    </div>

                    <div>
                      <label htmlFor="auth-reg-password" className="block text-xs mb-1.5">
                        Senha
                      </label>
                      <div className="relative">
                        <input
                          id="auth-reg-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          placeholder="Crie uma senha segura"
                          className="w-full h-11 pl-3.5 pr-10 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((v) => !v)}
                          aria-label={showRegisterPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99968F] hover:text-[#171717] cursor-pointer"
                        >
                          {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <PasswordPolicyList password={registerPassword} />
                    </div>

                    <div>
                      <label htmlFor="auth-reg-confirm" className="block text-xs mb-1.5">
                        Confirmar senha
                      </label>
                      <input
                        id="auth-reg-confirm"
                        type={showRegisterPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={registerConfirmPassword}
                        onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                      />
                    </div>

                    {authError && (
                      <div role="alert" className="border border-[#8A2C2C]/35 bg-[#8A2C2C]/5 p-3 flex items-start gap-2 text-xs text-[#8A2C2C]">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/90 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {authSubmitting ? 'Criando conta...' : 'Criar Conta'}
                    </button>

                    <p className="text-[11px] text-[#99968F]">
                      Um e-mail de confirmação será enviado para ativar sua conta com segurança.
                    </p>
                  </form>
                )}

                {authMode === 'reset' && (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-4" noValidate>
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight">
                        Recuperar senha
                      </h2>
                      <p className="text-xs text-[#171717]/75">
                        Informe o e-mail da sua conta para receber instruções de redefinição.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="auth-reset-email" className="block text-xs mb-1.5">
                        E-mail cadastrado
                      </label>
                      <input
                        id="auth-reset-email"
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full h-11 px-3.5 bg-[#F1EEE8] border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                      />
                    </div>

                    {authError && (
                      <div role="alert" className="border border-[#8A2C2C]/35 bg-[#8A2C2C]/5 p-3 flex items-start gap-2 text-xs text-[#8A2C2C]">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    {resetSubmittedMessage && (
                      <div role="status" className="border border-[#6A705C]/45 bg-[#6A705C]/10 p-3 flex items-start gap-2 text-xs text-[#171717]">
                        <CheckCircle2 className="w-4 h-4 text-[#6A705C] shrink-0 mt-0.5" />
                        <span>{resetSubmittedMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/90 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {authSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
                    </button>
                  </form>
                )}

                {authNotice && <p className="text-xs text-[#6A705C]">{authNotice}</p>}

                {/* Divider & Google Auth */}
                <div className="pt-2 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#171717]/15" />
                    <span className="font-mono-tabular text-[10px] uppercase tracking-[0.16em] text-[#99968F]">
                      ou
                    </span>
                    <span className="h-px flex-1 bg-[#171717]/15" />
                  </div>

                  <button
                    type="button"
                    disabled={authSubmitting}
                    onClick={() => void handleGoogleSignIn()}
                    className="w-full h-11 border border-[#171717] bg-[#F1EEE8] text-[#171717] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/5 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Continuar com Google
                  </button>
                </div>
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
                    <div key={ord.id} className="border border-[#171717]/15 p-4 flex items-center justify-between">
                      <div>
                        <p className="font-mono-tabular text-sm font-medium">{ord.orderNumber}</p>
                        <p className="text-xs text-[#99968F]">
                          Pedido Demo Local · {ord.items.length} item(ns)
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm">{formatBrl(ord.totalBrl)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Authenticated but Unverified Email Gate */}
        {user && !user.emailVerified && (
          <div className="pt-10 max-w-xl">
            <div className="border border-[#171717]/20 bg-[#EAE6DF]/60 p-8 space-y-5">
              <div className="inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#6A705C]">
                <MailCheck className="w-4 h-4" />
                <span>Confirmação de E-mail Obrigatória</span>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Confirme seu endereço de e-mail para ativar sua conta
              </h2>
              <p className="text-sm leading-relaxed text-[#171717]/80">
                Enviamos um link de confirmação para{' '}
                <strong className="font-mono-tabular">{user.email}</strong>. Por segurança, seu perfil e histórico de pedidos na nuvem são liberados após a confirmação.
              </p>

              {verificationFeedback && (
                <p className="text-xs text-[#171717] border border-[#171717]/15 bg-[#F1EEE8] p-3">
                  {verificationFeedback}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  disabled={verificationBusy}
                  onClick={() => void handleCheckVerification()}
                  className="px-5 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] disabled:opacity-50 cursor-pointer"
                >
                  {verificationBusy ? 'Verificando...' : 'Já confirmei meu e-mail'}
                </button>
                <button
                  type="button"
                  disabled={verificationBusy || resendCooldown > 0}
                  onClick={() => void handleResendVerification()}
                  className="px-5 py-3 border border-[#171717]/30 font-mono-tabular text-xs uppercase tracking-[0.12em] disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : 'Reenviar confirmação'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verified Customer / Admin Account Workspace */}
        {user && user.emailVerified && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10">
            {/* Left column: Admin module (admins only), Profile, Security & Linking, Addresses */}
            <div className="lg:col-span-5 space-y-8">
              {/* Strictly invisible to guests and regular customers */}
              {isAdmin && (
                <div className="border border-[#6A705C]/60 bg-[#EAE6DF]/70 p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#6A705C]">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Administração da Loja</span>
                    </span>
                    <span className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 border border-[#6A705C]/40 text-[#6A705C]">
                      ADMIN ATIVO
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#171717]/80">
                    Sua conta possui permissões de administração verificadas no servidor para gerenciar catálogo, imagens, estoque, pedidos, cupons e logs de auditoria.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/90 cursor-pointer"
                  >
                    Abrir Console Administrativo
                  </button>
                </div>
              )}

              {/* Customer Profile */}
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
                    className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="acc-email" className="block text-xs mb-1">E-mail verificado</label>
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
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs"
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
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
                >
                  Salvar Perfil
                </button>
              </form>

              {/* Access Methods & Safe Linking */}
              <div className="border border-[#171717]/15 p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Métodos de Acesso & Segurança</span>
                  </h2>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-[#171717]/10">
                    <span>E-mail e Senha</span>
                    <span className={`font-mono-tabular uppercase text-[11px] ${hasPasswordProvider ? 'text-[#6A705C]' : 'text-[#99968F]'}`}>
                      {hasPasswordProvider ? 'Ativo' : 'Não vinculado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#171717]/10">
                    <span>Conta Google</span>
                    <span className={`font-mono-tabular uppercase text-[11px] ${hasGoogleProvider ? 'text-[#6A705C]' : 'text-[#99968F]'}`}>
                      {hasGoogleProvider ? 'Vinculada' : 'Não vinculada'}
                    </span>
                  </div>
                </div>

                {securitySuccess && (
                  <p className="text-xs text-[#6A705C] inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{securitySuccess}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {hasPasswordProvider && !hasGoogleProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSecurityError('');
                        setSecurityPanelOpen((prev) => (prev === 'linkGoogle' ? 'none' : 'linkGoogle'));
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase tracking-[0.08em] hover:border-[#171717] cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Vincular Google</span>
                    </button>
                  )}

                  {hasGoogleProvider && !hasPasswordProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSecurityError('');
                        setSecurityPanelOpen((prev) => (prev === 'linkPassword' ? 'none' : 'linkPassword'));
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase tracking-[0.08em] hover:border-[#171717] cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Criar Senha de Acesso</span>
                    </button>
                  )}

                  {hasPasswordProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSecurityError('');
                        setSecurityPanelOpen((prev) => (prev === 'changePassword' ? 'none' : 'changePassword'));
                      }}
                      className="px-3 py-2 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase tracking-[0.08em] hover:border-[#171717] cursor-pointer"
                    >
                      Alterar Senha
                    </button>
                  )}
                </div>

                {securityPanelOpen === 'linkGoogle' && (
                  <form onSubmit={handleLinkGoogleSubmit} className="pt-3 border-t border-[#171717]/10 space-y-3">
                    <p className="text-xs text-[#171717]/75">
                      Para vincular sua Conta Google manualmente, confirme sua senha atual antes de prosseguir.
                    </p>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Senha atual"
                      value={linkCurrentPassword}
                      onChange={(e) => setLinkCurrentPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    {securityError && <p className="text-xs text-[#8A2C2C]">{securityError}</p>}
                    <button
                      type="submit"
                      disabled={securityBusy}
                      className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase disabled:opacity-50 cursor-pointer"
                    >
                      {securityBusy ? 'Vinculando...' : 'Confirmar e Vincular Google'}
                    </button>
                  </form>
                )}

                {securityPanelOpen === 'linkPassword' && (
                  <form onSubmit={handleLinkPasswordSubmit} className="pt-3 border-t border-[#171717]/10 space-y-3">
                    <p className="text-xs text-[#171717]/75">
                      Adicione uma senha para entrar também por e-mail. Será solicitada uma nova confirmação via Google antes de concluir.
                    </p>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nova senha"
                      value={linkNewPassword}
                      onChange={(e) => setLinkNewPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    <PasswordPolicyList password={linkNewPassword} />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirmar nova senha"
                      value={linkConfirmPassword}
                      onChange={(e) => setLinkConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    {securityError && <p className="text-xs text-[#8A2C2C]">{securityError}</p>}
                    <button
                      type="submit"
                      disabled={securityBusy}
                      className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase disabled:opacity-50 cursor-pointer"
                    >
                      {securityBusy ? 'Processando...' : 'Confirmar via Google e Ativar Senha'}
                    </button>
                  </form>
                )}

                {securityPanelOpen === 'changePassword' && (
                  <form onSubmit={handleChangePasswordSubmit} className="pt-3 border-t border-[#171717]/10 space-y-3">
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Senha atual"
                      value={changeCurrentPassword}
                      onChange={(e) => setChangeCurrentPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nova senha"
                      value={changeNewPassword}
                      onChange={(e) => setChangeNewPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    <PasswordPolicyList password={changeNewPassword} />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirmar nova senha"
                      value={changeConfirmPassword}
                      onChange={(e) => setChangeConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/25 text-xs"
                    />
                    {securityError && <p className="text-xs text-[#8A2C2C]">{securityError}</p>}
                    <button
                      type="submit"
                      disabled={securityBusy}
                      className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase disabled:opacity-50 cursor-pointer"
                    >
                      {securityBusy ? 'Atualizando...' : 'Salvar Nova Senha'}
                    </button>
                  </form>
                )}
              </div>

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
                    className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {newAddressOpen && (
                  <form onSubmit={handleAddAddress} className="space-y-3 pt-2 border-t border-[#171717]/10">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Etiqueta (Casa, Trabalho)"
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="CEP"
                        value={addrCep}
                        onChange={(e) => setAddrCep(formatCep(e.target.value))}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Destinatário"
                      value={addrRecipient}
                      onChange={(e) => setAddrRecipient(e.target.value)}
                      className="w-full h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Rua / Av."
                        value={addrStreet}
                        onChange={(e) => setAddrStreet(e.target.value)}
                        className="col-span-2 h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Nº"
                        value={addrNumber}
                        onChange={(e) => setAddrNumber(e.target.value)}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Bairro"
                        value={addrNeighborhood}
                        onChange={(e) => setAddrNeighborhood(e.target.value)}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Cidade"
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs"
                      />
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="UF"
                        value={addrState}
                        onChange={(e) => setAddrState(e.target.value.toUpperCase())}
                        className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase cursor-pointer"
                    >
                      Salvar Endereço
                    </button>
                  </form>
                )}

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
                        className="text-[#99968F] hover:text-[#171717] cursor-pointer"
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
                    className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
                  >
                    Explorar catálogo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <div key={ord.id} className="border border-[#171717]/15 p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono-tabular text-sm font-medium">
                            {ord.orderNumber}
                          </span>
                          <span className="ml-3 font-mono-tabular text-[11px] uppercase text-[#99968F]">
                            {ord.status} {ord.isDemo ? '(Demo)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono-tabular text-sm font-medium">
                            {formatBrl(ord.totalBrl)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOrder(selectedOrder?.id === ord.id ? null : ord)
                            }
                            className="font-mono-tabular text-[11px] uppercase underline cursor-pointer"
                          >
                            {selectedOrder?.id === ord.id ? 'Ocultar' : 'Detalhes'}
                          </button>
                        </div>
                      </div>

                      {selectedOrder?.id === ord.id && (
                        <div className="pt-3 border-t border-[#171717]/10 space-y-2 text-xs">
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
