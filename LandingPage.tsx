import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Clock3, Download, FolderOpen, KeyRound, Link2, LockKeyhole, Menu, QrCode, ShieldCheck, X } from 'lucide-react';
import { Logo } from './common';
import { LanguageToggle, useLanguage } from '../i18n';

export default function LandingPage({ onOpenApp, onOpenVault }: { onOpenApp: () => void; onOpenVault: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const { t } = useLanguage();
  const closeMenu = () => setMenuOpen(false);
  const navLinks = [
    ['Features', '#features'], ['How it works', '#how-it-works'], ['Privacy', '#privacy'], ['FAQ', '#faq'],
  ];
  const faqs = [
    ['Where are project files stored?', 'After you sign in with Google, project details and selected files are saved to the cloud services connected to your account.'],
    ['Is Google sign-in required?', 'Yes. Sign in with Google before opening the workspace or any cloud share page.'],
    ['Can a cloud link open on another device?', 'Cloud links can open on another device when the Cloud API and private file storage are configured and working. Recipients also need to sign in with Google.'],
    ['Can Vault files be shared?', 'No. Vault entries are stored separately from projects, shared lists, public links, and QR codes. The passphrase gates Vault access; the app does not claim end-to-end encryption.'],
    ['What happens when a cloud share expires?', 'The Cloud API blocks access after the expiration time. Physical file cleanup runs on the configured schedule and is not an exact-time erasure guarantee.'],
  ];

  return (
    <div className="clean-landing">
      <header className="clean-header">
        <a href="#top" className="clean-brand" aria-label={t('Sharing home')} onClick={closeMenu}><Logo /></a>
        <nav id="clean-primary-navigation" className={`clean-nav${menuOpen ? ' clean-nav-open' : ''}`} aria-label={t('Main navigation')}>
          {navLinks.map(([label, href]) => <a href={href} key={href} onClick={closeMenu}>{t(label)}</a>)}
          <button className="button button-primary clean-nav-cta" onClick={() => { closeMenu(); onOpenApp(); }}>{t('Open your workspace')} <ArrowRight size={16} /></button>
        </nav>
        <div className="clean-header-actions">
          <LanguageToggle />
          <button className="button button-primary clean-header-cta" onClick={onOpenApp}>{t('Open your workspace')} <ArrowRight size={16} /></button>
          <button className="icon-button clean-menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? t('Close menu') : t('Open menu')} aria-controls="clean-primary-navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="clean-hero">
          <div className="clean-hero-copy">
            <div className="clean-eyebrow"><span />{t('FILE SHARING, MADE SIMPLE')}</div>
            <h1>{t('Share files')}<br /><span>{t('with less friction.')}</span></h1>
            <p className="clean-hero-lead">{t('Bring selected files together, choose how they can be opened, and share one clear link.')}</p>
            <div className="clean-hero-actions">
              <button className="button button-primary button-large" onClick={onOpenApp}>{t('Open your workspace')} <ArrowRight size={17} /></button>
              <a className="clean-text-link" href="#how-it-works">{t('How it works')} <ArrowRight size={15} /></a>
            </div>
            <div className="clean-hero-note"><Check size={15} />{t('Google sign-in · cloud projects · separate Vault')}</div>
          </div>

          <div className="clean-hero-art" role="img" aria-label={t('Illustration of a project handoff')}>
            <div className="clean-art-halo" />
            <div className="clean-art-frame">
              <div className="clean-art-topbar"><Logo small /><span>{t('PROJECT HANDOFF')}</span><i /><i /><i /></div>
              <div className="clean-art-content">
                <div className="clean-art-heading"><span>{t('A clear space for your files')}</span><span className="clean-art-status"><Check size={13} />{t('Ready to share')}</span></div>
                <div className="clean-art-folder"><span className="clean-art-folder-icon"><FolderOpen size={22} /></span><div><strong>{t('Files you select')}</strong><small>{t('Kept together in one project')}</small></div><Check size={16} /></div>
                <div className="clean-art-flow"><span /><span /><span /></div>
                <div className="clean-art-link"><span><Link2 size={17} /></span><div><strong>{t('One clear link')}</strong><small>{t('Access is set by you')}</small></div><QrCode size={18} /></div>
                <div className="clean-art-footer"><ShieldCheck size={15} />{t('Your Vault stays separate')}</div>
              </div>
            </div>
            <div className="clean-art-side-note"><LockKeyhole size={15} /><span>{t('Private by separation')}</span></div>
          </div>
        </section>

        <section className="clean-section clean-features" id="features">
          <div className="clean-section-heading">
            <span className="clean-section-label">{t('THE ESSENTIALS')}</span>
            <h2>{t('A simple workspace for clear handoffs.')}</h2>
            <p>{t('Keep the process easy to understand, from choosing files to sharing them.')}</p>
          </div>
          <div className="clean-feature-grid">
            <Feature icon={<FolderOpen size={21} />} title={t('Keep related files together')} description={t('Put the files you choose into one named project that is easy to find and manage.')} />
            <Feature icon={<KeyRound size={21} />} title={t('Choose how people access them')} description={t('Use a share link, add a password, set an expiration, or keep the project private.')} />
            <Feature icon={<Download size={21} />} title={t('Make downloads straightforward')} description={t('Recipients can download an available file or prepare the project as a ZIP.')} />
            <Feature icon={<QrCode size={21} />} title={t('Share one clear link or QR')} description={t('Give recipients a focused page with only the files in that project.')} />
            <Feature icon={<LockKeyhole size={21} />} title={t('Keep the Vault separate')} description={t('Vault entries are not added to projects, public links, or QR codes.')} />
            <Feature icon={<Clock3 size={21} />} title={t('Set an expiration')} description={t('Cloud links stop opening after their expiration; cleanup follows the configured schedule.')} />
          </div>
        </section>

        <section className="clean-section clean-how" id="how-it-works">
          <div className="clean-section-heading clean-how-heading">
            <span className="clean-section-label">{t('THREE CLEAR STEPS')}</span>
            <h2>{t('From files to a finished handoff.')}</h2>
            <p>{t('A short, clear flow keeps each decision in the right place.')}</p>
          </div>
          <div className="clean-steps">
            <Step number="01" icon={<FolderOpen size={19} />} title={t('Choose your files')} description={t('Select files or a folder and give the project a clear name.')} />
            <Step number="02" icon={<ShieldCheck size={19} />} title={t('Set the access')} description={t('Choose link access, a password, an expiration, or private access.')} />
            <Step number="03" icon={<Link2 size={19} />} title={t('Share the handoff')} description={t('Copy the link or share its QR code with the people who need it.')} />
          </div>
        </section>

        <section className="clean-privacy" id="privacy">
          <div className="clean-privacy-icon"><LockKeyhole size={22} /></div>
          <div className="clean-privacy-copy">
            <span className="clean-section-label">{t('PRIVATE MEANS PRIVATE')}</span>
            <h2>{t('Your Vault stays outside the handoff.')}</h2>
            <p>{t('Vault entries are kept separate from projects and cannot create public links, QR codes, or project downloads.')}</p>
            <div className="clean-privacy-note"><ShieldCheck size={16} /><span>{t('A passphrase gates Vault API access; the app does not claim end-to-end encryption.')}</span></div>
          </div>
          <button className="button button-secondary clean-vault-button" onClick={onOpenVault}>{t('Open the Vault')} <ArrowRight size={15} /></button>
        </section>

        <section className="clean-section clean-faq" id="faq">
          <div className="clean-section-heading">
            <span className="clean-section-label">{t('GOOD TO KNOW')}</span>
            <h2>{t('Questions, answered.')}</h2>
            <p>{t('Clear answers about required sign-in, cloud files, and Vault separation.')}</p>
          </div>
          <div className="clean-faq-card">
            {faqs.map(([question, answer], index) => (
              <div className={`clean-faq-item${faqOpen === index ? ' clean-faq-item-open' : ''}`} key={question}>
                <button className="clean-faq-question" type="button" onClick={() => setFaqOpen(faqOpen === index ? null : index)} aria-expanded={faqOpen === index}>
                  <span>{t(question)}</span><ChevronDown size={18} />
                </button>
                {faqOpen === index && <p className="clean-faq-answer">{t(answer)}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="clean-final-cta">
          <span className="clean-section-label">{t('READY WHEN YOU ARE')}</span>
          <h2>{t('Make the next handoff simpler.')}</h2>
          <p>{t('Open the workspace to bring your files together and choose how to share them.')}</p>
          <button className="button button-primary button-large" onClick={onOpenApp}>{t('Open your workspace')} <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer className="clean-footer">
        <div className="clean-footer-top"><Logo small /><span>{t('Thoughtful sharing, one project at a time.')}</span><a href="#top">{t('Back to top')} <ArrowRight size={14} /></a></div>
        <div className="clean-footer-bottom"><span>© 2026 Sharing</span><a className="tarek-credit-button" href="https://www.instagram.com/mindfulltarek?srtk=MTJmcGt2bGp5Nmt6dw==" target="_blank" rel="noopener noreferrer">Developed by TAREK</a></div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <article className="clean-feature-card"><span className="clean-feature-icon">{icon}</span><h3>{title}</h3><p>{description}</p></article>;
}

function Step({ number, icon, title, description }: { number: string; icon: React.ReactNode; title: string; description: string }) {
  return <article className="clean-step-card"><div className="clean-step-heading"><span className="clean-step-icon">{icon}</span><span className="clean-step-number">{number}</span></div><h3>{title}</h3><p>{description}</p></article>;
}
