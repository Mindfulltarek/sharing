import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowDownToLine, Clock3, Cloud, Download, Info, KeyRound, Link2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Project, ProjectFile } from '../types';
import { CloudApiError, cloudApi } from '../services/cloudApi';
import { downloadBlob, formatBytes, formatDate } from '../services';
import { FileGlyph, Logo } from './common';
import { LanguageToggle, useLanguage } from '../i18n';

interface CloudSharePageProps {
  token: string;
  onHome: () => void;
  onOpenAccount: () => void;
  saved: boolean;
  owned: boolean;
  onSaveToAccount: (token: string) => Promise<boolean>;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}

const messageFor = (error: unknown) => error instanceof CloudApiError ? error.message : error instanceof Error ? error.message : 'The request could not be completed.';
const safeFileName = (value: string) => (value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || 'project');

export default function CloudSharePage({ token, onHome, onOpenAccount, saved, owned, onSaveToAccount, onToast }: CloudSharePageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  const loadShare = useCallback(async () => {
    setLoading(true); setProject(null); setRequiresPassword(false); setExpired(false); setNotFound(false); setLoadError(''); setPasswordError('');
    try {
      const result = await cloudApi.getPublicShare(token);
      setRequiresPassword(result.requiresPassword);
      if (result.project) setProject(result.project);
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 404) setNotFound(true);
      else if (error instanceof CloudApiError && error.status === 410) setExpired(true);
      else setLoadError(messageFor(error));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void loadShare(); }, [loadShare]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setPasswordError('Enter the password provided by the project owner.'); return; }
    setUnlocking(true); setPasswordError('');
    try {
      const result = await cloudApi.unlockPublicShare(token, password);
      setRequiresPassword(result.requiresPassword);
      setProject(result.project || null);
      setPassword('');
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 410) setExpired(true);
      else setPasswordError(error instanceof CloudApiError && error.status === 401 ? 'That password did not match. Try again.' : messageFor(error));
    } finally { setUnlocking(false); }
  };

  const downloadOne = async (file: ProjectFile) => {
    setDownloadBusy(file.id);
    try {
      const blob = await cloudApi.downloadPublicShareFile(token, file.id);
      downloadBlob(blob, file.name);
      onToast(t('Download started'), file.name, 'success');
    } catch (error) {
      onToast(t('Download failed'), t(messageFor(error)), 'error');
    } finally { setDownloadBusy(null); }
  };

  const downloadAll = async () => {
    if (!project) return;
    setDownloadBusy('all');
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      let count = 0;
      for (const file of project.files) {
        if (file.available === false) continue;
        const blob = await cloudApi.downloadPublicShareFile(token, file.id);
        zip.file(file.relativePath || file.name, blob);
        count++;
      }
      if (!count) throw new Error('There are no available files in this share.');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${safeFileName(project.name)}.zip`);
      onToast(t('Project ZIP ready'), t('{count} files added to the archive.', { count }), 'success');
    } catch (error) {
      onToast(t('Could not prepare the project ZIP'), t(messageFor(error)), 'error');
    } finally { setDownloadBusy(null); }
  };

  const saveToAccount = async () => {
    if (project?.privacy === 'password') { onToast(t('Password-protected share'), t('The server does not allow password-only shares to be saved in Shared with me.'), 'info'); return; }
    if (owned) { onToast(t('This is your project'), t('Open it from your account dashboard instead of saving it as a shared item.'), 'info'); return; }
    if (saved || saving) return;
    setSaving(true);
    try { await onSaveToAccount(token); } finally { setSaving(false); }
  };

  const totalSize = project?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const readyCount = project?.files.filter((file) => file.available !== false).length ?? 0;

  return <main className="cloud-share-page">
    <header className="cloud-share-header"><button className="cloud-brand" type="button" onClick={onHome} aria-label={t('Back to Sharing')}><Logo /></button><div className="cloud-top-actions"><LanguageToggle /><span className="cloud-share-mark"><Link2 size={13} /> {t('CLOUD SHARE')}</span><button className="button button-secondary button-sm" type="button" onClick={onOpenAccount}>{t('Open account workspace')} <ArrowRight size={14} /></button></div></header>
    <div className="cloud-share-content">
      {loading ? <div className="cloud-share-state"><LoaderCircle size={24} className="cloud-spin" /><strong>{t('Checking this share…')}</strong><span>{t('The server is verifying its current access settings.')}</span></div> : expired ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Clock3 size={23} /></div><div className="cloud-section-kicker">{t('SHARE EXPIRED')}</div><h1>{t('This share has expired.')}</h1><p>{t('The server no longer allows this link to open. Ask the owner for a current link.')}</p><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> {t('Back to Sharing')}</button></div> : notFound ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Link2 size={23} /></div><div className="cloud-section-kicker">{t('LINK NOT FOUND')}</div><h1>{t('This share isn’t available.')}</h1><p>{t('The link may be incorrect, private, revoked, expired, or no longer available. Check it with the project owner.')}</p><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> {t('Back to Sharing')}</button></div> : loadError ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Cloud size={23} /></div><div className="cloud-section-kicker">{t('SHARE SERVICE')}</div><h1>{t('We couldn’t check this link.')}</h1><p>{t(loadError)}</p><button className="button button-secondary" type="button" onClick={() => void loadShare()}><LoaderCircle size={14} /> {t('Try again')}</button></div> : requiresPassword && !project ? <section className="cloud-password-card"><div className="cloud-password-icon"><LockKeyhole size={23} /></div><div className="cloud-section-kicker">{t('PASSWORD-PROTECTED SHARE')}</div><h1>{t('Enter the project password.')}</h1><p>{t('The owner protected this share. Enter the password they sent separately to unlock the file list.')}</p><form onSubmit={(event) => void unlock(event)}><label className="field-label" htmlFor="cloud-public-password">{t('Share password')}</label><div className="cloud-public-password"><KeyRound size={16} /><input id="cloud-public-password" type="password" autoComplete="off" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(''); }} placeholder={t('Enter the password')} autoFocus /></div>{passwordError && <div className="inline-error" role="alert">{t(passwordError)}</div>}<button className="button button-primary cloud-unlock-button" type="submit" disabled={unlocking || password.length < 8}>{unlocking ? <><LoaderCircle size={15} className="cloud-spin" /> {t('Checking…')}</> : <>{t('Unlock project')} <ArrowRight size={15} /></>}</button></form><div className="cloud-password-foot"><ShieldCheck size={14} /> {t('The server checks the password before showing project details.')}</div></section> : project ? <>
        <section className="cloud-share-hero"><div className="cloud-section-kicker"><span className="cloud-share-mark-icon"><Cloud size={13} /></span> {t('SHARED PROJECT')} <span className="cloud-breadcrumb-separator">/</span> {t('DOWNLOAD PAGE')}</div><div className="cloud-share-title-row"><div><div className="cloud-share-owner"><span className="cloud-owner-avatar">S</span><span>{t('SHARED WITH YOU')}</span><span className="cloud-share-access"><LockKeyhole size={12} />{project.privacy === 'password' ? t('PASSWORD VERIFIED') : t('LINK ACCESS')}</span></div><h1>{project.name}</h1><p>{project.files.length} {project.files.length === 1 ? t('file') : t('files')} <i>·</i> {formatBytes(totalSize)}{project.expiresAt ? <><i>·</i> {t('Expires')} {formatDate(project.expiresAt)}</> : null}</p></div><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> {t('Back')}</button></div></section>
        <section className="cloud-share-banner"><div className="cloud-share-banner-icon"><Download size={19} /></div><div><strong>{t('Your files are available')}</strong><span>{t('Download a single file or prepare the project as a ZIP.')}</span></div><button className="button button-secondary" type="button" onClick={() => void saveToAccount()} disabled={saving || saved || owned || project.privacy === 'password'}>{saving ? <><LoaderCircle size={15} className="cloud-spin" /> {t('Saving…')}</> : saved ? <><ShieldCheck size={15} /> {t('Saved to account')}</> : owned ? <><ShieldCheck size={15} /> {t('Your project')}</> : project.privacy === 'password' ? <><LockKeyhole size={15} /> {t('Password-only share')}</> : <><Link2 size={15} /> {t('Save to account')}</>}</button><button className="button button-primary" type="button" onClick={() => void downloadAll()} disabled={!readyCount || downloadBusy !== null}>{downloadBusy === 'all' ? <><LoaderCircle size={15} className="cloud-spin" /> {t('Preparing…')}</> : <><Download size={15} /> {t('Download all')}</>}</button></section>
        <section className="cloud-share-file-card"><div className="cloud-share-file-heading"><div><h2>{t('Project files')} <span>{project.files.length}</span></h2><p>{t('Files are downloaded from the private store through the share API.')}</p></div><strong>{formatBytes(totalSize)}</strong></div>{project.files.length ? <div className="cloud-public-files">{project.files.map((file) => <div className="cloud-file-row" key={file.id}><FileGlyph file={file} size={16} /><div className="cloud-file-info"><strong>{file.name}</strong><span>{file.relativePath && file.relativePath !== file.name ? file.relativePath : file.type || t('File')} · {formatBytes(file.size)}</span></div><button className="button button-secondary button-sm" type="button" onClick={() => void downloadOne(file)} disabled={downloadBusy !== null || file.available === false}>{downloadBusy === file.id ? <LoaderCircle size={14} className="cloud-spin" /> : <ArrowDownToLine size={14} />} {file.available === false ? t('Unavailable') : t('Download')}</button></div>)}</div> : <div className="cloud-no-public-files">{t('No files are currently available in this share.')}</div>}<div className="cloud-share-file-note"><Info size={14} /><span>{t('Files are delivered by the owner’s server-side access settings; Vault files are never part of cloud project shares.')}</span></div></section>
        <aside className="cloud-share-safety"><ShieldCheck size={16} /><span>{t('Only files included in this cloud project are available here. If the link is password protected, file downloads remain gated by the server.')}</span><span className="cloud-share-expiration">{project.expiresAt ? t('Expires {date}', { date: formatDate(project.expiresAt, true) }) : t('No expiration set')}</span></aside>
      </> : null}
    </div>
    <footer className="cloud-footer"><span>{t('Shared through Sharing · Vault files are separate.')}</span><a className="tarek-credit-button" href="https://www.instagram.com/mindfulltarek?srtk=MTJmcGt2bGp5Nmt6dw==" target="_blank" rel="noopener noreferrer">Developed by TAREK</a></footer>
  </main>;
}
