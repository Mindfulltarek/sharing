import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, Download, Eye, FileDown, Info, KeyRound, Link2, LockKeyhole, ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { Project, ProjectFile } from '../types';
import { formatBytes, formatDate, isExpired, verifySecret } from '../services';
import { FileGlyph, Logo, ProjectFileList, totalSize } from './common';

export default function PublicSharePage({
  project, onGoHome, onOpenApp, onOpenShared, onViewed, onDownloadFile, onPreviewFile, onDownloadAll, onImport, imported, onToast,
}: {
  project: Project | null;
  onGoHome: () => void;
  onOpenApp: () => void;
  onOpenShared: () => void;
  onViewed: (project: Project) => void;
  onDownloadFile: (project: Project, file: ProjectFile) => void;
  onPreviewFile: (project: Project, file: ProjectFile) => void;
  onDownloadAll: (project: Project) => void;
  onImport: (project: Project) => void;
  imported: boolean;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [unlocked, setUnlocked] = useState(project?.privacy !== 'password');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const viewedRef = useRef<string | null>(null);
  const privateLink = project?.privacy === 'private';
  const expired = !!project && isExpired(project);
  const needsPassword = project?.privacy === 'password';

  useEffect(() => {
    setUnlocked(project?.privacy !== 'password');
    setPassword('');
    setPasswordError('');
    viewedRef.current = null;
  }, [project?.token, project?.privacy]);

  useEffect(() => {
    if (project && unlocked && !expired && !privateLink && viewedRef.current !== project.id) {
      viewedRef.current = project.id;
      onViewed(project);
    }
  }, [project, unlocked, expired, privateLink, onViewed]);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project?.passwordHash) { setPasswordError('This demo link could not be verified.'); return; }
    if (!/^[A-Za-z0-9]{4,8}$/.test(password)) { setPasswordError('Enter the 4–8 character project password.'); return; }
    setVerifying(true);
    setPasswordError('');
    try {
      if (await verifySecret(password, project.passwordHash)) setUnlocked(true);
      else setPasswordError('That password doesn’t match. Try again.');
    } catch { setPasswordError('The password could not be checked in this browser.'); }
    finally { setVerifying(false); }
  };

  const importedToast = () => {
    onImport(project!);
    onToast(imported ? 'Already saved' : 'Saved to Shared with me', imported ? 'This project is already in your local demo workspace.' : 'The project metadata was added to this browser.', imported ? 'info' : 'success');
  };

  return (
    <div className="public-share-page">
      <header className="public-share-header"><button className="logo-link" onClick={onGoHome} aria-label="Go to Sharing home"><Logo /></button><div className="public-header-right"><span className="public-demo-mark"><span className="status-pulse" /> LOCAL DEMO</span><button className="public-open-app" onClick={onOpenApp}>Open Sharing <ArrowRight size={14} /></button></div></header>
      <main className="public-share-main">
        {!project || privateLink ? <NotFoundState onBack={onGoHome} /> : expired ? <ExpiredState onBack={onGoHome} /> : needsPassword && !unlocked ? (
          <section className="password-gate-card"><div className="password-gate-orb" /><div className="password-gate-icon"><LockKeyhole size={25} /></div><div className="public-gate-kicker">PASSWORD-PROTECTED SHARE</div><h1>Enter the project password.</h1><p>This link is protected. Enter the password shared with you to view the project.</p><form className="public-password-form" onSubmit={submitPassword}><label className="field-label" htmlFor="public-share-password">Project password</label><div className="public-password-input"><KeyRound size={16} /><input id="public-share-password" type="password" autoComplete="off" value={password} onChange={(event) => { setPassword(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)); setPasswordError(''); }} placeholder="4–8 letters and numbers" maxLength={8} autoFocus /></div>{passwordError && <div className="public-password-error">{passwordError}</div>}<button type="submit" className="button button-primary public-password-submit" disabled={verifying || password.length < 4}>{verifying ? 'Checking…' : 'Unlock project'} <ArrowRight size={15} /></button></form><div className="password-gate-foot"><ShieldCheck size={14} /> No project details are shown until the password is verified.</div></section>
        ) : (
          <section className="public-project-page">
            <div className="public-project-head"><div className="public-project-breadcrumb"><span className="public-breadcrumb-mark"><Link2 size={13} /></span> SHARED PROJECT <span>/</span> DOWNLOAD PAGE</div><div className="public-project-title-row"><div><div className="public-project-owner"><span className="public-owner-avatar">S</span><span>SHARED WITH YOU</span><span className="public-private-label"><LockKeyhole size={12} /> {project.privacy === 'password' ? 'PASSWORD VERIFIED' : 'LINK ACCESS'}</span></div><h1>{project.name}</h1><p>{project.files.length} files <span>·</span> {formatBytes(totalSize(project.files))}{project.expiresAt ? <><span>·</span> Expires {formatDate(project.expiresAt)}</> : null}</p></div><button className="button button-secondary public-back-button" onClick={onGoHome}><ArrowLeft size={15} /> Back</button></div></div>
            <div className="public-download-banner"><div className="public-download-icon"><Download size={19} /></div><div><strong>Your files are ready</strong><span>Download one file at a time or grab the whole project as a ZIP.</span></div><button className="button button-primary" onClick={() => onDownloadAll(project)} disabled={!project.files.length}><Download size={15} /> Download all</button></div>
            <div className="public-project-grid"><section className="public-files-card"><div className="public-files-heading"><div><h2>Project files <span>{project.files.length}</span></h2><p>Choose a file to download.</p></div><span className="public-total-size">{formatBytes(totalSize(project.files))}</span></div><ProjectFileList files={project.files} onDownload={(file) => onDownloadFile(project, file)} onPreview={(file) => onPreviewFile(project, file)} /><div className="public-download-note"><Info size={14} /> Downloads are counted as demo activity in the owner’s project view.</div></section><aside className="public-project-aside"><div className="public-aside-card"><div className="public-aside-icon"><FileDown size={18} /></div><div className="section-kicker">YOUR DOWNLOAD</div><h3>Take the whole handoff.</h3><p>Get the available project files in one ZIP with a small project manifest.</p><button className="button button-secondary public-aside-download" onClick={() => onDownloadAll(project)}><Download size={15} /> Download project ZIP</button></div><div className="public-aside-card public-import-card"><div className="public-aside-icon import-icon"><Users size={18} /></div><div className="section-kicker">KEEP IT CLOSE</div><h3>{imported ? 'Already in your workspace.' : 'Save for later.'}</h3><p>{imported ? 'This project is saved to Shared with me in this browser demo.' : 'Add this project to your local Shared with me list. No sign-in needed.'}</p><button className={`button ${imported ? 'button-secondary' : 'button-primary'} public-aside-download`} onClick={imported ? onOpenShared : importedToast}>{imported ? <><Check size={15} /> View saved project</> : <><PlusIcon /> Save to my Sharing</>}</button></div></aside></div>
            <div className="public-expiration-note"><Clock3 size={14} /><span>{project.expiresAt ? `This demo share expires ${formatDate(project.expiresAt, true)}. Expiration disables the link; no cloud storage is connected.` : 'This demo share has no expiration set. No cloud storage is connected.'}</span></div>
          </section>
        )}
      </main>
      <footer className="public-share-footer"><span>Shared with <Logo small /></span><span><ShieldCheck size={13} /> Demo page · No real cloud files are hosted</span></footer>
    </div>
  );
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return <div className="public-state-card"><div className="public-state-symbol"><Link2 size={24} /></div><div className="section-kicker">LINK NOT FOUND</div><h1>This share isn’t available.</h1><p>The link may be incorrect, private, or no longer available in this browser’s demo data.</p><button className="button button-secondary" onClick={onBack}><ArrowLeft size={15} /> Back to Sharing</button></div>;
}

function ExpiredState({ onBack }: { onBack: () => void }) {
  return <div className="public-state-card expired-public-state"><div className="public-state-symbol"><Clock3 size={25} /></div><div className="section-kicker">SHARE EXPIRED</div><h1>This share has expired.</h1><p>Its demo link is no longer active. The owner can re-upload the project to create a new share.</p><div className="public-expired-lock"><LockKeyhole size={14} /> Project files are hidden while expired</div><button className="button button-secondary" onClick={onBack}><ArrowLeft size={15} /> Back to Sharing</button></div>;
}

function PlusIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }
