import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from './common';

export default function LoginPage({ onGoogleDemo, onContinueDemo, onBack }: { onGoogleDemo: () => void; onContinueDemo: () => void; onBack: () => void }) {
  return (
    <main className="login-page">
      <div className="login-background-glow login-glow-one" /><div className="login-background-glow login-glow-two" />
      <header className="login-header"><button className="logo-link" onClick={onBack} aria-label="Back to Sharing landing page"><Logo /></button><span className="login-header-demo"><span className="status-pulse" /> DEMO ACCESS</span></header>
      <div className="login-layout">
        <section className="login-story">
          <div className="login-story-pill"><Sparkles size={13} /> A THOUGHTFUL WAY TO SHARE</div>
          <h1>Your files.<br /><span className="hero-gradient-text">One simple share.</span></h1>
          <p>Sign-in is optional in this preview. Open the demo workspace now and explore projects, share links, and a separate private Vault.</p>
          <div className="login-story-points"><span><Check size={14} /> No account needed to explore</span><span><Check size={14} /> Sample projects are saved locally</span><span><Check size={14} /> Cloud sharing is not connected yet</span></div>
          <div className="login-illustration" aria-hidden="true"><div className="login-illus-orb" /><div className="login-illus-file illus-file-one"><span className="illus-file-glyph glyph-violet">S</span><i /><i /></div><div className="login-illus-file illus-file-two"><span className="illus-file-glyph glyph-rose">↗</span><i /><i /></div><div className="login-illus-link"><LockKeyhole size={14} /><span>One simple link</span><div /></div><div className="login-illus-star">✦</div></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-brand"><span className="login-mini-mark"><Logo small /></span></div>
          <div className="login-card-kicker">WELCOME TO SHARING</div>
          <h2 id="login-title">Your workspace<br />is ready.</h2>
          <p>Choose how you’d like to continue. This preview works without a Google account.</p>
          <button type="button" className="google-demo-button" onClick={onGoogleDemo}><GoogleGlyph /><span>Continue with Google</span><span className="google-demo-tag">DEMO</span></button>
          <div className="login-divider"><span /> <small>OR</small> <span /></div>
          <button type="button" className="button button-primary login-continue-button" onClick={onContinueDemo}>Continue in demo <ArrowRight size={16} /></button>
          <div className="login-demo-note"><ShieldCheck size={15} /><span><strong>Demo mode:</strong> The Google button opens a local sample workspace. No OAuth connection or Google account is used.</span></div>
          <button type="button" className="login-back-link" onClick={onBack}><ArrowLeft size={14} /> Back to the landing page</button>
          <div className="login-policy-note"><LockKeyhole size={12} /> Your demo data stays in this browser.</div>
        </section>
      </div>
      <footer className="login-footer"><span>Developed by <a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">TAREK</a></span><span>© 2026 Sharing · Demo preview</span></footer>
    </main>
  );
}

function GoogleGlyph() {
  return <svg className="google-glyph" viewBox="0 0 48 48" role="img" aria-label="Google"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.1v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.6 16 44 24 44Z"/><path fill="#4A90E2" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.5 29.5 3.5 24 3.5 16 3.5 9.2 7.9 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}
