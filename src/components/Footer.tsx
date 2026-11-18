import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandMark } from './BrandMark';
import {
  formatNewsletterSubmissionError,
  NEWSLETTER_EMAIL_MAX_LENGTH,
  validateNewsletterEmail,
} from '../utils/newsletter';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { editorial, openAdvisor, subscribeNewsletter } = useStore();

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const emailValidation = validateNewsletterEmail(email, {
    enforceRequired: hasAttemptedSubmit,
  });

  const showEmailError =
    status !== 'success' &&
    emailValidation.status === 'invalid' &&
    (hasInteracted || hasAttemptedSubmit || email.trim().length > 0);

  const isEmailValid = status !== 'success' && emailValidation.status === 'valid';

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setEmail(nextValue);
    if (!hasInteracted && nextValue.length > 0) {
      setHasInteracted(true);
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleEmailBlur = () => {
    if (email.length > 0) {
      setHasInteracted(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setHasInteracted(true);
    setSubmitError(null);

    const validation = validateNewsletterEmail(email, { enforceRequired: true });
    if (validation.status !== 'valid') {
      emailInputRef.current?.focus();
      return;
    }

    if (!consent) {
      setSubmitError('Confirme o consentimento abaixo para concluir a inscrição.');
      return;
    }

    setStatus('submitting');
    try {
      await subscribeNewsletter(validation.normalized, true);
      setConfirmedEmail(validation.normalized);
      setStatus('success');
      setEmail('');
      setConsent(false);
      setHasInteracted(false);
      setHasAttemptedSubmit(false);
    } catch (err) {
      setStatus('idle');
      setSubmitError(formatNewsletterSubmissionError(err));
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setConfirmedEmail('');
    setEmail('');
    setConsent(false);
    setHasInteracted(false);
    setHasAttemptedSubmit(false);
    setSubmitError(null);
  };

  return (
    <footer className="bg-[#F1EEE8] text-[#171717] border-t border-[#171717]/15">
      {/* Newsletter Band inside Footer */}
      <div className="bg-[#EAE6DF]/55 border-b border-[#171717]/12">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start lg:items-center">
            <div className="lg:col-span-5 space-y-2">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
                COMUNICADOS / NEWSLETTER
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">
                Receba avisos de próximos lançamentos.
              </h2>
              <p className="text-sm text-[#171717]/75 max-w-md">
                Apenas notificações sobre novas coleções e reposições. Sem spam ou envios automáticos frequentes.
              </p>
            </div>

            <div className="lg:col-span-7">
              {status === 'success' ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="page-transition-enter border border-[#6A705C]/50 bg-[#F1EEE8] px-5 py-5 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#6A705C]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Inscrição confirmada</span>
                    </div>
                    <p className="text-sm text-[#171717] leading-relaxed">
                      Avisos de lançamentos e reposições serão enviados para{' '}
                      <span className="font-mono-tabular font-medium [overflow-wrap:anywhere]">
                        {confirmedEmail}
                      </span>
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="self-start sm:self-center shrink-0 font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#171717]/75 hover:text-[#171717] underline underline-offset-4 cursor-pointer transition-colors duration-200"
                  >
                    Cadastrar outro e-mail
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <label htmlFor="footer-newsletter-email" className="sr-only">
                        Seu endereço de e-mail
                      </label>
                      <input
                        ref={emailInputRef}
                        id="footer-newsletter-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={NEWSLETTER_EMAIL_MAX_LENGTH}
                        value={email}
                        onChange={handleEmailChange}
                        onBlur={handleEmailBlur}
                        aria-invalid={showEmailError ? 'true' : 'false'}
                        aria-describedby="footer-newsletter-feedback"
                        placeholder="seu@email.com"
                        className={`w-full h-11 pl-4 pr-10 bg-[#F1EEE8] border text-sm placeholder:text-[#99968F] focus:outline-none transition-colors duration-200 motion-reduce:transition-none ${
                          showEmailError
                            ? 'border-[#8A2C2C] focus:border-[#8A2C2C]'
                            : isEmailValid
                            ? 'border-[#6A705C] focus:border-[#6A705C]'
                            : 'border-[#171717]/25 focus:border-[#171717]'
                        }`}
                      />
                      {showEmailError && (
                        <AlertCircle
                          className="w-4 h-4 text-[#8A2C2C] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                      {isEmailValid && (
                        <Check
                          className="w-4 h-4 text-[#6A705C] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="h-11 px-6 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/90 disabled:opacity-50 transition-colors duration-200 shrink-0 cursor-pointer motion-reduce:transition-none"
                    >
                      {status === 'submitting' ? 'Enviando...' : 'Inscrever-se'}
                    </button>
                  </div>

                  {/* Real-time inline validation & error feedback */}
                  <div
                    id="footer-newsletter-feedback"
                    aria-live="polite"
                    className="min-h-[18px]"
                  >
                    {showEmailError && emailValidation.message ? (
                      <p role="alert" className="text-xs text-[#8A2C2C]">
                        {emailValidation.message}
                      </p>
                    ) : submitError ? (
                      <p role="alert" className="text-xs text-[#8A2C2C]">
                        {submitError}
                      </p>
                    ) : isEmailValid ? (
                      <p className="font-mono-tabular text-[11px] tracking-[0.04em] text-[#6A705C]">
                        E-mail válido — confirme o consentimento abaixo para concluir.
                      </p>
                    ) : null}
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-[#171717]/75 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        if (e.target.checked && submitError) {
                          setSubmitError(null);
                        }
                      }}
                      className="mt-0.5 accent-[#171717] cursor-pointer"
                    />
                    <span>
                      Concordo em receber comunicações da COMPLEX e com o tratamento de dados conforme a política de privacidade.
                    </span>
                  </label>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-14 border-b border-[#171717]/12">
          {/* Institucional */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Institucional
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Sobre a COMPLEX
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/collections')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Coleção 01 — Editorial
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/shop')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Catálogo Completo
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="hover:underline underline-offset-4 text-[#6A705C] cursor-pointer"
                >
                  Painel Administrativo
                </button>
              </li>
            </ul>
          </div>

          {/* Atendimento */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Atendimento
            </h3>
            <ul className="space-y-2 text-sm text-[#171717]/80">
              <li>{editorial.contactEmail}</li>
              <li>
                <button
                  type="button"
                  onClick={openAdvisor}
                  className="inline-flex items-center gap-1 text-[#171717] hover:underline underline-offset-4 cursor-pointer"
                >
                  Consultoria de Caimento <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/account')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Minha Conta & Pedidos
                </button>
              </li>
            </ul>
          </div>

          {/* Entregas e Devoluções */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Entregas & Devoluções
            </h3>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              {editorial.shippingNote}
            </p>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              {editorial.returnsNote}
            </p>
          </div>

          {/* Privacidade, Termos & Redes */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Políticas & Redes
            </h3>
            <ul className="space-y-2 text-sm text-[#171717]/80">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about#privacidade')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Política de Privacidade (Configurável)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about#termos')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Termos de Uso (Configurável)
                </button>
              </li>
              <li className="font-mono-tabular text-xs pt-1 text-[#171717]">
                {editorial.instagramHandle}
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Wordmark Lockup */}
        <div className="pt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="inline-flex items-center gap-3 text-[#171717]">
            <BrandMark className="w-11 h-5 md:w-14 md:h-7 shrink-0" />
            <span className="font-display text-3xl md:text-5xl font-extrabold tracking-[-0.04em] leading-none">
              COMPLEX
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F]">
            <span>Streetwear Independente</span>
            <span aria-hidden="true">/</span>
            <span>Catálogo Demonstrativo Configurável</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
