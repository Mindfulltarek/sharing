import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Cloud, Info, LockKeyhole, Sparkles } from 'lucide-react';
import { Logo } from './common';
import { LanguageToggle, useLanguage } from '../i18n';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityApi {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
  prompt: (callback?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

export default function LoginPage({
  clientId,
  onGoogleCredential,
  onGoogleSuccess,
  onBack,
}: {
  clientId: string;
  onGoogleCredential: (credential: string) => Promise<{ email: string }>;
  onGoogleSuccess: (user: { email: string }) => void;
  onBack: () => void;
}) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const authAttemptRef = useRef(0);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [googleScriptError, setGoogleScriptError] = useState(false);
  const [scriptRetry, setScriptRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try { return window.localStorage.getItem('sharing.rememberGoogle.v1') === 'true'; } catch { return false; }
  });
  const { language, t } = useLanguage();

  useEffect(() => {
    if (!clientId) return;
    if (window.google?.accounts?.id) {
      setGoogleLoaded(true);
      return;
    }
    let script = document.getElementById('google-identity-services') as HTMLScriptElement | null;
    const createdHere = !script;
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
    }
    const markLoaded = () => setGoogleLoaded(true);
    const markFailed = () => setGoogleScriptError(true);
    script.addEventListener('load', markLoaded);
    script.addEventListener('error', markFailed);
    if (createdHere) document.head.appendChild(script);
    return () => {
      script?.removeEventListener('load', markLoaded);
      script?.removeEventListener('error', markFailed);
    };
  }, [clientId, scriptRetry]);

  useEffect(() => {
    const element = googleButtonRef.current;
    const identity = window.google?.accounts?.id;
    if (!clientId || !googleLoaded || !identity || !element) return;
    element.replaceChildren();
    identity.initialize({
      client_id: clientId,
      auto_select: rememberMe,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
      callback: (response) => {
        if (!response.credential) {
          setError('Google did not return an ID token. Try again.');
          return;
        }
        const attempt = ++authAttemptRef.current;
        setError('');
        setBusy(true);
        void onGoogleCredential(response.credential)
          .then((user) => {
            if (authAttemptRef.current !== attempt) return;
            authAttemptRef.current += 1;
            onGoogleSuccess(user);
          })
          .catch((authError: unknown) => {
            if (authAttemptRef.current !== attempt) return;
            setError(authError instanceof Error ? authError.message : 'Google sign-in could not be completed.');
          })
          .finally(() => {
            if (authAttemptRef.current === attempt) setBusy(false);
          });
      },
    });
    identity.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.max(160, Math.min(360, Math.floor(element.getBoundingClientRect().width || 360))),
      locale: language,
    });
    if (rememberMe) identity.prompt();
  }, [clientId, googleLoaded, language, onGoogleCredential, onGoogleSuccess, rememberMe]);

  const explainConfiguration = () => {
    if (!clientId) {
      setError('Google sign-in needs VITE_GOOGLE_CLIENT_ID in the deployment and the matching GOOGLE_CLIENT_ID on the server.');
      return;
    }
    setError('');
    setGoogleScriptError(false);
    document.getElementById('google-identity-services')?.remove();
    setScriptRetry((attempt) => attempt + 1);
  };

  const changeRememberMe = (checked: boolean) => {
    setRememberMe(checked);
    try {
      if (checked) window.localStorage.setItem('sharing.rememberGoogle.v1', 'true');
      else window.localStorage.removeItem('sharing.rememberGoogle.v1');
    } catch { /* The Google button still works if browser storage is unavailable. */ }
  };

  const returnToLanding = () => {
    authAttemptRef.current += 1;
    setBusy(false);
    onBack();
  };

  return (
    <main className="login-page">
      <div className="login-background-glow login-glow-one" /><div className="login-background-glow login-glow-two" />
      <header className="login-header">
        <button className="logo-link" onClick={returnToLanding} aria-label={t('Back to the landing page')}><Logo /></button>
        <div className="login-header-actions"><LanguageToggle /><span className="login-header-status"><span className="status-pulse" /> {t('ACCOUNT ACCESS')}</span></div>
      </header>
      <div className="login-layout">
        <section className="login-story">
          <div className="login-story-pill"><Sparkles size={14} /> {t('A THOUGHTFUL WAY TO SHARE')}</div>
          <h1>{t('Your files.')}<br /><span className="hero-gradient-text">{t('One simple share.')}</span></h1>
          <p>{t('Sign in with Google to verify your account.')}</p>
          <div className="login-story-points">
            <span><Check size={15} /> {t('Protected API access after account verification')}</span>
            <span><Check size={15} /> {t('A separate private Vault')}</span>
            <span><Check size={15} /> {t('One dashboard for your account projects')}</span>
          </div>
          <div className="login-illustration" aria-hidden="true"><div className="login-illus-orb" /><div className="login-illus-file illus-file-one"><span className="illus-file-glyph glyph-violet">↗</span><i /><i /></div><div className="login-illus-file illus-file-two"><span className="illus-file-glyph glyph-rose">✦</span><i /><i /></div><div className="login-illus-link"><LockKeyhole size={15} /><span>{t('One simple link')}</span><div /></div><div className="login-illus-star">✦</div></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-brand"><Logo small /></div>
          <div className="login-card-kicker">{t('WELCOME TO SHARING')}</div>
          <h2 id="login-title">{t('Your workspace')}<br />{t('is ready.')}</h2>
          <p>{t('Sign in with Google to connect this dashboard to your account. Server configuration is required.')}</p>
          <div className="google-signin-slot" role="group" aria-label={t('Sign in with Google')} aria-busy={busy || Boolean(clientId && !googleLoaded)} aria-live="polite">
            {clientId && googleLoaded ? <div className={`google-identity-button${busy ? ' google-signin-busy' : ''}`} ref={googleButtonRef} /> : (
              <button type="button" className="google-auth-button-placeholder" onClick={explainConfiguration} disabled={busy || Boolean(clientId && !googleScriptError)}>
                <GoogleGlyph />
                <span>{busy ? t('Signing in…') : clientId ? googleScriptError ? t('Retry Google sign-in') : t('Loading Google…') : t('Continue with Google')}</span>
              </button>
            )}
          </div>
          <label className="remember-me-row"><input type="checkbox" checked={rememberMe} onChange={(event) => changeRememberMe(event.target.checked)} /><span className="remember-me-check" aria-hidden="true"><Check size={13} /></span><span><strong>{t('Remember me')}</strong><small>{t('Use Google’s device session to remember this account. The app does not store your ID token.')}</small></span></label>
          {googleScriptError && <div className="login-inline-error" role="alert"><Info size={15} /> {t('Google Identity Services could not load. Check the connection or content blocker.')}</div>}
          {error && <div className="login-inline-error" role="alert"><Info size={15} /> {t(error)}</div>}
          <div className="login-cloud-note"><Cloud size={16} /><span>{t('A Google account is required. Project files are uploaded to cloud storage after you sign in.')}</span></div>
          <button type="button" className="login-back-link" onClick={returnToLanding}><ArrowLeft size={14} /> {t('Back to the landing page')}</button>
        </section>
      </div>
      <footer className="login-footer"><span>Developed by <a className="tarek-credit-button" href="https://www.instagram.com/mindfulltarek?srtk=MTJmcGt2bGp5Nmt6dw==" target="_blank" rel="noopener noreferrer">TAREK</a></span><span>© 2026 Sharing · {t('Account access')}</span></footer>
    </main>
  );
}

function GoogleGlyph() {
  return <svg className="google-glyph" viewBox="0 0 48 48" role="img" aria-label="Google"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.1v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.6 16 44 24 44Z"/><path fill="#4A90E2" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.5 29.5 3.5 24 3.5 16 3.5 9.2 7.9 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}
