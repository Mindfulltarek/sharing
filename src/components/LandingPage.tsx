import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, ChevronDown, Clock3, Download, Eye, FileImage, FolderOpen, HelpCircle, KeyRound, Link2, LockKeyhole, Menu, QrCode, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Logo } from './common';

export default function LandingPage({ onOpenApp, onOpenVault }: { onOpenApp: () => void; onOpenVault: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const closeMenu = () => setMenuOpen(false);
  const navLinks = [
    ['Features', '#features'], ['How it works', '#how-it-works'], ['Privacy', '#privacy'], ['FAQ', '#faq'],
  ];
  const faqs = [
    ['Can I protect a link with a password?', 'Projects can use open, password-protected, or private access. Protected links should be verified before project details or file names are shown.'],
    ['What happens when a project expires?', 'With cloud storage configured, the API stops access when a share expires. Physical file cleanup follows the configured storage schedule.'],
    ['Can recipients download one file or everything?', 'A shared project can offer individual file downloads and a ZIP download when those files are available.'],
    ['Are Vault files private?', 'Vault entries stay separate from public projects and cannot create links or QR codes. File contents are not client-side encrypted, so review your storage setup before adding sensitive material.'],
    ['Can I sign in with Google?', 'Google sign-in requires matching website and server client IDs, an authorized site origin, and a configured backend. You can also continue without an account.'],
  ];

  return (
    <div className="landing-page">
      <header className="marketing-header">
        <a href="#top" className="logo-link" aria-label="Sharing home"><Logo /></a>
        <nav className={`marketing-nav${menuOpen ? ' marketing-nav-open' : ''}`} aria-label="Main navigation">
          {navLinks.map(([label, href]) => <a href={href} key={href} onClick={closeMenu}>{label}</a>)}
          <button className="button button-primary nav-mobile-cta" onClick={() => { closeMenu(); onOpenApp(); }}>Open Sharing <ArrowRight size={16} /></button>
        </nav>
        <div className="marketing-header-actions">
          <button className="button button-primary header-open-button" onClick={onOpenApp}>Open Sharing <ArrowRight size={16} /></button>
          <button className="icon-button mobile-menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-glow hero-glow-a" />
          <div className="hero-glow hero-glow-b" />
          <div className="hero-copy">
            <div className="eyebrow-pill"><span className="eyebrow-dot" /> A calmer way to share files</div>
            <h1>Your files.<br /><span className="hero-gradient-text">One simple share.</span></h1>
            <p>Create a project, share one link, and let people download exactly what you choose.</p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={onOpenApp} >Open your workspace <ArrowRight size={17} /></button>
              <a href="#features" className="button button-quiet button-large">See how it works <ArrowDown size={16} /></a>
            </div>
            <div className="hero-reassurance"><span className="tiny-check"><Check size={12} /></span> No sign-in needed <span className="reassurance-dot">·</span> Runs locally in this browser</div>
          </div>
          <div className="landing-dashboard-wrap" aria-label="Preview of the Sharing workspace">
            <div className="preview-orbit preview-orbit-one" />
            <div className="preview-orbit preview-orbit-two" />
            <DashboardPreview />
            <div className="hero-floating-elements" aria-hidden="true">
              <div className="hero-floating-file-card"><span className="hero-file-art-icon"><FileImage size={20} /></span><span className="hero-floating-copy"><small>SAMPLE PROJECT</small><strong>Visual assets</strong><span>4 files · Preview</span></span><span className="hero-floating-check"><Check size={13} /></span></div>
              <div className="hero-floating-link-card"><span className="hero-floating-link-icon"><Link2 size={16} /></span><span><small>SHARE LINK</small><strong>One clear handoff</strong></span><span className="hero-floating-status" /></div>
              <div className="hero-art-spark hero-art-spark-one">✦</div><div className="hero-art-spark hero-art-spark-two">✧</div>
            </div>
            <div className="preview-caption"><span className="caption-live-dot" /> Your workspace, at a glance <span className="caption-preview">WORKSPACE PREVIEW</span></div>
          </div>
          <div className="hero-bottom-fade" />
        </section>

        <section className="trust-strip" aria-label="Product highlights">
          <div><span className="trust-icon"><FolderOpen size={17} /></span> Projects, not clutter</div>
          <span className="trust-separator" />
          <div><span className="trust-icon"><QrCode size={17} /></span> Link or QR</div>
          <span className="trust-separator" />
          <div><span className="trust-icon"><ShieldCheck size={17} /></span> A separate private Vault</div>
        </section>

        <section className="section-block feature-section" id="features">
          <div className="section-heading">
            <div className="section-kicker">MADE FOR THE HANDOFF</div>
            <h2>Everything in its place.<br /><span className="muted-gradient">Nothing in the way.</span></h2>
            <p>Simple controls for the parts of sharing that should feel simple.</p>
          </div>
          <div className="feature-grid">
            <Feature icon={<FolderOpen />} number="01" title="Projects with purpose" description="Keep related files together in one named, easy-to-find handoff." className="feature-wide" />
            <Feature icon={<Link2 />} number="02" title="One link, your way" description="Share a link or QR code, with optional password protection and an expiration." />
            <Feature icon={<Download />} number="03" title="Download what you need" description="Recipients can grab one file or the whole available project as a ZIP." />
            <Feature icon={<Eye />} number="04" title="A useful activity view" description="Review project activity at a glance when connected to your workspace." />
            <Feature icon={<LockKeyhole />} number="05" title="A Vault that stays separate" description="Private Vault items never become a public link, QR code, or project export." className="feature-wide feature-vault" />
          </div>
        </section>

        <section className="section-block how-section" id="how-it-works">
          <div className="how-copy">
            <div className="section-kicker">THREE STEPS, THAT’S IT</div>
            <h2>From files to<br />a finished handoff.</h2>
            <p>Make a tidy project, choose how it can be accessed, and share it with confidence.</p>
            <button className="button button-secondary" onClick={onOpenApp} >Open your workspace <ArrowRight size={16} /></button>
          </div>
          <div className="steps-list">
            <Step number="01" icon={<Box />} title="Create a project" text="Choose files or a folder, then give the handoff a name." />
            <Step number="02" icon={<KeyRound />} title="Set sharing options" text="Choose link access, a password, an expiration, or keep it private." />
            <Step number="03" icon={<QrCode />} title="Share the link or QR" text="Recipients see a clean download page, not your whole workspace." />
          </div>
        </section>

        <section className="section-block handoff-section">
          <div className="handoff-visual" aria-label="Preview of a shared project download page">
            <div className="handoff-browser-bar"><span /><span /><span /><div className="browser-address"><LockKeyhole size={11} /> sharing.app/share/••••••</div></div>
            <div className="handoff-inner">
              <div className="handoff-brand"><span className="mini-mark">S</span><span>SHARING</span><span className="handoff-divider">/</span><span>PROJECT SHARE</span></div>
              <div className="handoff-content-row">
                <div className="handoff-title-area">
                  <span className="handoff-label">A PROJECT FOR YOU</span>
                  <h3>Northstar identity kit</h3>
                  <p>4 files <span>·</span> 5.4 KB <span>·</span> Expires in 6 days</p>
                </div>
                <span className="button button-primary handoff-download"><Download size={15} /> Download all</span>
              </div>
              <div className="handoff-file-list">
                <MiniFile icon="md" name="Brand-direction.md" size="1.1 KB" />
                <MiniFile icon="svg" name="Northstar-mark.svg" size="694 B" />
                <MiniFile icon="csv" name="Palette.csv" size="172 B" />
              </div>
              <div className="handoff-local-note"><LockKeyhole size={13} /> A clean, focused page for the files you chose to share.</div>
            </div>
          </div>
          <div className="handoff-copy">
            <div className="section-kicker">A BETTER RECIPIENT EXPERIENCE</div>
            <h2>Give people the files.<br /><span className="muted-gradient">Keep the rest yours.</span></h2>
            <p>Every share has its own focused page, with clear file details and individual or bulk downloads. A password gate appears before file names when a project is protected.</p>
            <div className="handoff-points">
              <span><Check size={15} /> Individual file downloads</span>
              <span><Check size={15} /> One-click ZIP when available</span>
              <span><Check size={15} /> Expiration and access status</span>
            </div>
          </div>
        </section>

        <section className="vault-section" id="privacy">
          <div className="vault-glow" />
          <div className="vault-copy">
            <div className="section-kicker">PRIVATE MEANS PRIVATE</div>
            <h2>A separate place<br />for what <span className="hero-gradient-text">isn’t for sharing.</span></h2>
            <p>The Vault is intentionally outside your project workflow. It has its own unlock step, and Vault entries can’t generate public links, QR codes, or exports.</p>
            <div className="vault-disclaimer"><ShieldCheck size={18} /><span><strong>Privacy by separation.</strong> Vault items stay out of share links. File contents are not client-side encrypted; review your storage setup before adding sensitive material.</span></div>
            <button className="button button-secondary" onClick={onOpenVault}>Explore the Vault <ArrowRight size={16} /></button>
          </div>
          <div className="vault-visual">
            <div className="vault-card-glow" />
            <div className="vault-lock-rings"><div className="vault-lock-ring ring-outer" /><div className="vault-lock-ring ring-middle" /><div className="vault-lock-center"><LockKeyhole size={35} strokeWidth={1.5} /></div></div>
            <div className="vault-label"><span className="vault-label-dot" /> LOCAL VAULT <span>LOCKED</span></div>
            <div className="vault-blur-card vault-card-one"><span className="vault-file-icon"><FileTiny /></span><span><i /><i /></span><LockKeyhole size={13} /></div>
            <div className="vault-blur-card vault-card-two"><span className="vault-file-icon vault-file-icon-alt"><FileTiny /></span><span><i /><i /></span><LockKeyhole size={13} /></div>
          </div>
        </section>

        <section className="privacy-note section-block">
          <div className="privacy-icon"><Clock3 size={22} /></div>
          <div><div className="section-kicker">CLEAR EXPIRATION, NO SURPRISES</div><h2>When a share ends, it ends.</h2><p>With cloud storage configured, expired links stop working immediately. Physical file cleanup follows the storage schedule and is not an exact-time erasure guarantee.</p></div>
          <button className="text-link-button" onClick={onOpenApp}>See it in the workspace <ArrowUpRight size={15} /></button>
        </section>

        <section className="section-block faq-section" id="faq">
          <div className="faq-intro"><div className="section-kicker">GOOD TO KNOW</div><h2>Questions, answered.</h2><p>Clear answers about access, privacy, and sharing.</p><div className="faq-callout"><HelpCircle size={17} /><span>Need help with account or storage setup? Check your deployment settings.</span></div></div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <div className={`faq-item${faqOpen === index ? ' faq-item-open' : ''}`} key={question}>
                <button className="faq-question" onClick={() => setFaqOpen(faqOpen === index ? null : index)} aria-expanded={faqOpen === index}>
                  <span>{question}</span><ChevronDown size={18} />
                </button>
                {faqOpen === index && <p className="faq-answer">{answer}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="closing-cta">
          <div className="closing-glow" />
          <div className="closing-mark"><span className="brand-mark"><span /></span></div>
          <div className="section-kicker">READY WHEN YOU ARE</div>
          <h2>Make the next handoff<br /><span className="hero-gradient-text">feel effortless.</span></h2>
          <p>Open your workspace or sign in with Google when it’s configured.</p>
          <button className="button button-primary button-large" onClick={onOpenApp}>Open Sharing <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="footer-top"><Logo small /><span className="footer-tagline">Thoughtful sharing, one project at a time.</span><a className="footer-open" href="#top">Back to top <ArrowUpRight size={14} /></a></div>
        <div className="footer-bottom"><span>© 2026 Sharing</span><span className="footer-credit">Developed by <a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">TAREK <ArrowUpRight size={12} /></a></span></div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-preview">
      <div className="preview-topbar">
        <div className="preview-brand"><span className="mini-mark">S</span><span>sharing<span className="brand-period">.</span></span></div>
        <div className="preview-breadcrumb">Workspace <span>/</span> Projects</div>
        <div className="preview-profile"><span className="preview-profile-dot">D</span><span>Your account</span><ChevronDown size={12} /></div>
      </div>
      <div className="preview-main-layout">
        <div className="preview-sidebar">
          <div className="preview-side-label">WORKSPACE</div>
          <div className="preview-side-item preview-side-active"><FolderOpen size={14} /> Projects <span>4</span></div>
          <div className="preview-side-item"><Link2 size={14} /> Shared with me</div>
          <div className="preview-side-item"><LockKeyhole size={14} /> Vault</div>
          <div className="preview-side-bottom"><div className="preview-side-item"><ShieldCheck size={14} /> Workspace preview</div></div>
        </div>
        <div className="preview-content">
          <div className="preview-welcome-row"><div><span className="preview-eyebrow">WORKSPACE PREVIEW</span><h3>Your projects</h3><p>Keep every handoff in one place.</p></div><div className="preview-create"><span>+</span> New project</div></div>
          <div className="preview-mini-stats"><div><span>Active projects</span><strong>—</strong></div><div><span>Shared views</span><strong>—</strong></div><div><span>Downloads</span><strong>—</strong></div></div>
          <div className="preview-list-head"><span>RECENT PROJECTS</span><span>UPDATED <ChevronDown size={11} /></span></div>
          <PreviewProject name="Northstar identity kit" files="4 files · 5.4 KB" views="—" downloads="—" type="svg" />
          <PreviewProject name="Kyoto field notes" files="4 files · 3.1 KB" views="—" downloads="—" type="md" protected />
          <PreviewProject name="Lumen launch pack" files="4 files · 4.8 KB" views="—" downloads="—" type="csv" private />
        </div>
      </div>
      <div className="preview-glass-note"><Sparkles size={13} /> A clear view of every handoff</div>
    </div>
  );
}

function PreviewProject({ name, files, views, downloads, type, protected: protectedProject, private: privateProject }: { name: string; files: string; views: string; downloads: string; type: string; protected?: boolean; private?: boolean }) {
  return <div className="preview-project-row"><span className={`preview-file-type type-${type}`}>{type.toUpperCase()}</span><span className="preview-project-name"><strong>{name}</strong><small>{files}</small></span><span className="preview-project-lock">{protectedProject ? <LockKeyhole size={13} /> : privateProject ? <ShieldCheck size={13} /> : <Link2 size={13} />}</span><span className="preview-project-stats"><Eye size={12} /> {views}</span><span className="preview-project-stats"><Download size={12} /> {downloads}</span><span className="preview-row-more">···</span></div>;
}

function Feature({ icon, number, title, description, className = '' }: { icon: React.ReactNode; number: string; title: string; description: string; className?: string }) {
  return <article className={`feature-card ${className}`}><div className="feature-card-top"><span className="feature-icon">{icon}</span><span className="feature-number">{number}</span></div><div><h3>{title}</h3><p>{description}</p></div><span className="feature-arrow"><ArrowUpRight size={14} /></span></article>;
}

function Step({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return <div className="step-row"><div className="step-marker"><span className="step-icon">{icon}</span><span className="step-number">{number}</span></div><div className="step-copy"><h3>{title}</h3><p>{text}</p></div><ArrowRight className="step-arrow" size={17} /></div>;
}

function MiniFile({ icon, name, size }: { icon: string; name: string; size: string }) {
  return <div className="mini-file-row"><span className={`mini-file-icon mini-file-${icon}`}>{icon.toUpperCase()}</span><span>{name}</span><small>{size}</small><ArrowDown size={14} /></div>;
}

function FileTiny() {
  return <svg viewBox="0 0 20 22" width="18" height="20" fill="none" aria-hidden="true"><path d="M3 2.5h8l6 6v11H3z" stroke="currentColor" strokeWidth="1.3"/><path d="M11 2.5v6h6M6 13h8M6 16h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}
