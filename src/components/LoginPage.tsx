import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from './common';

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
  onContinueWithoutAccount,
  onBack,
}: {
  clientId: string;
  onGoogleCredential: (credential: string) => Promise<{ email: string }>;
  onGoogleSuccess: (user: { email: string }) => void;
  onContinueWithoutAccount: () => void;
  onBack: () => void;
}) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const authAttemptRef = useRef(0);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [googleScriptError, setGoogleScriptError] = useState(false);
  const [scriptRetry, setScriptRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      auto_select: false,
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
      locale: 'en',
    });
  }, [clientId, googleLoaded, onGoogleCredential, onGoogleSuccess]);

  const explainConfiguration = () => {
    if (!clientId) {
      setError('Google sign-in needs VITE_GOOGLE_CLIENT_ID in .env.local or Vercel and the matching GOOGLE_CLIENT_ID on the server.');
      return;
    }
    setError('');
    setGoogleScriptError(false);
    document.getElementById('google-identity-services')?.remove();
    setScriptRetry((attempt) => attempt + 1);
  };

  const continueLocally = () => {
    authAttemptRef.current += 1;
    setBusy(false);
    onContinueWithoutAccount();
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
        <button className="logo-link" onClick={returnToLanding} aria-label="Back to Sharing landing page"><Logo /></button>
        <span className="login-header-status"><span className="status-pulse" /> ACCOUNT ACCESS</span>
      </header>
      <div className="login-layout">
        <section className="login-story">
          <div className="login-story-pill"><Sparkles size={13} /> A THOUGHTFUL WAY TO SHARE</div>
          <h1>Your files.<br /><span className="hero-gradient-text">One simple share.</span></h1>
          <p>Sign in with Google to verify your account, or continue without signing in.</p>
          <div className="login-story-points">
            <span><Check size={14} /> Protected API access after account verification</span>
            <span><Check size={14} /> A separate private Vault</span>
            <span><Check size={14} /> A browser-only option remains available</span>
          </div>
          <div className="login-illustration" aria-hidden="true"><div className="login-illus-orb" /><div className="login-illus-file illus-file-one"><span className="illus-file-glyph glyph-violet">S</span><i /><i /></div><div className="login-illus-file illus-file-two"><span className="illus-file-glyph glyph-rose">↗</span><i /><i /></div><div className="login-illus-link"><LockKeyhole size={14} /><span>One simple link</span><div /></div><div className="login-illus-star">✦</div></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-brand"><span className="login-mini-mark"><Logo small /></span></div>
          <div className="login-card-kicker">WELCOME TO SHARING</div>
          <h2 id="login-title">Your workspace<br />is ready.</h2>
          <p>Choose how you’d like to continue. Google sign-in requires the website and server client IDs to be configured.</p>
          <div className="google-signin-slot" role="group" aria-label="Sign in with Google" aria-busy={busy || Boolean(clientId && !googleLoaded)} aria-live="polite">
            {clientId && googleLoaded ? <div className={`google-identity-button${busy ? ' google-signin-busy' : ''}`} ref={googleButtonRef} /> : (
              <button type="button" className="google-auth-button-placeholder" onClick={explainConfiguration} disabled={busy || Boolean(clientId && !googleScriptError)}>
                <GoogleGlyph />
                <span>{busy ? 'Signing in…' : clientId ? googleScriptError ? 'Retry Google sign-in' : 'Loading Google…' : 'Continue with Google'}</span>
              </button>
            )}
          </div>
          {googleScriptError && <div className="login-inline-error" role="alert"><Info size={14} /> Google Identity Services could not load. Check the connection or content blocker.</div>}
          {error && <div className="login-inline-error" role="alert"><Info size={14} /> {error}</div>}
          <div className="login-divider"><span /> <small>OR</small> <span /></div>
          <button type="button" className="button button-primary login-continue-button" onClick={continueLocally}>Continue without account <ArrowRight size={16} /></button>
          <div className="login-local-note"><ShieldCheck size={15} /><span><strong>Browser workspace:</strong> Continuing without an account uses local project metadata. It does not sign you in or connect cloud storage.</span></div>
          <button type="button" className="login-back-link" onClick={returnToLanding}><ArrowLeft size={14} /> Back to the landing page</button>
          <div className="login-policy-note"><KeyRound size={12} /> Google ID tokens are sent to the server for verification.</div>
        </section>
      </div>
      <footer className="login-footer"><span>Developed by <a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">TAREK</a></span><span>© 2026 Sharing · Account access</span></footer>
    </main>
  );
}

function GoogleGlyph() {
  return <svg className="google-glyph" viewBox="0 0 48 48" role="img" aria-label="Google"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.1v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.6 16 44 24 44Z"/><path fill="#4A90E2" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.5 29.5 3.5 24 3.5 16 3.5 9.2 7.9 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}
