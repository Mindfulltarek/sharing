import { useCallback, useEffect, useState } from 'react';
import JSZip from 'jszip';
import { ArrowLeft, ArrowRight, ArrowDownToLine, Clock3, Cloud, Download, Info, KeyRound, Link2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Project, ProjectFile } from '../types';
import { CloudApiError, cloudApi } from '../services/cloudApi';
import { downloadBlob, formatBytes, formatDate } from '../services';
import { FileGlyph, Logo } from './common';

interface CloudSharePageProps {
  token: string;
  onHome: () => void;
  onOpenAccount: () => void;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}

const messageFor = (error: unknown) => error instanceof CloudApiError ? error.message : error instanceof Error ? error.message : 'The request could not be completed.';
const safeFileName = (value: string) => (value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || 'project');

export default function CloudSharePage({ token, onHome, onOpenAccount, onToast }: CloudSharePageProps) {
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
      onToast('Download started', file.name, 'success');
    } catch (error) {
      onToast('Download failed', messageFor(error), 'error');
    } finally { setDownloadBusy(null); }
  };

  const downloadAll = async () => {
    if (!project) return;
    setDownloadBusy('all');
    try {
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
      onToast('Project ZIP ready', `${count} ${count === 1 ? 'file' : 'files'} added to the archive.`, 'success');
    } catch (error) {
      onToast('Could not prepare the project ZIP', messageFor(error), 'error');
    } finally { setDownloadBusy(null); }
  };

  const totalSize = project?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const readyCount = project?.files.filter((file) => file.available !== false).length ?? 0;

  return <main className="cloud-share-page">
    <header className="cloud-share-header"><button className="cloud-brand" type="button" onClick={onHome} aria-label="Back to Sharing"><Logo /></button><div className="cloud-top-actions"><span className="cloud-share-mark"><Link2 size={13} /> CLOUD SHARE</span><button className="button button-secondary button-sm" type="button" onClick={onOpenAccount}>Open account workspace <ArrowRight size={14} /></button></div></header>
    <div className="cloud-share-content">
      {loading ? <div className="cloud-share-state"><LoaderCircle size={24} className="cloud-spin" /><strong>Checking this share…</strong><span>The server is verifying its current access settings.</span></div> : expired ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Clock3 size={23} /></div><div className="cloud-section-kicker">SHARE EXPIRED</div><h1>This share has expired.</h1><p>The server no longer allows this link to open. Ask the owner for a current link.</p><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> Back to Sharing</button></div> : notFound ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Link2 size={23} /></div><div className="cloud-section-kicker">LINK NOT FOUND</div><h1>This share isn’t available.</h1><p>The link may be incorrect, private, revoked, or no longer available. If it was created in a local browser workspace, it cannot be opened on another device.</p><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> Back to Sharing</button></div> : loadError ? <div className="cloud-share-state"><div className="cloud-share-state-icon"><Cloud size={23} /></div><div className="cloud-section-kicker">SHARE SERVICE</div><h1>We couldn’t check this link.</h1><p>{loadError}</p><button className="button button-secondary" type="button" onClick={() => void loadShare()}><LoaderCircle size={14} /> Try again</button></div> : requiresPassword && !project ? <section className="cloud-password-card"><div className="cloud-password-icon"><LockKeyhole size={23} /></div><div className="cloud-section-kicker">PASSWORD-PROTECTED SHARE</div><h1>Enter the project password.</h1><p>The owner protected this share. Enter the password they sent separately to unlock the file list.</p><form onSubmit={(event) => void unlock(event)}><label className="field-label" htmlFor="cloud-public-password">Share password</label><div className="cloud-public-password"><KeyRound size={16} /><input id="cloud-public-password" type="password" autoComplete="off" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(''); }} placeholder="Enter the password" autoFocus /></div>{passwordError && <div className="inline-error" role="alert">{passwordError}</div>}<button className="button button-primary cloud-unlock-button" type="submit" disabled={unlocking || password.length < 8}>{unlocking ? <><LoaderCircle size={15} className="cloud-spin" /> Checking…</> : <>Unlock project <ArrowRight size={15} /></>}</button></form><div className="cloud-password-foot"><ShieldCheck size={14} /> The server checks the password before showing project details.</div></section> : project ? <>
        <section className="cloud-share-hero"><div className="cloud-section-kicker"><span className="cloud-share-mark-icon"><Cloud size={13} /></span> SHARED PROJECT <span className="cloud-breadcrumb-separator">/</span> DOWNLOAD PAGE</div><div className="cloud-share-title-row"><div><div className="cloud-share-owner"><span className="cloud-owner-avatar">S</span><span>SHARED WITH YOU</span><span className="cloud-share-access"><LockKeyhole size={12} />{project.privacy === 'password' ? 'PASSWORD VERIFIED' : 'LINK ACCESS'}</span></div><h1>{project.name}</h1><p>{project.files.length} {project.files.length === 1 ? 'file' : 'files'} <i>·</i> {formatBytes(totalSize)}{project.expiresAt ? <><i>·</i> Expires {formatDate(project.expiresAt)}</> : null}</p></div><button className="button button-secondary" type="button" onClick={onHome}><ArrowLeft size={15} /> Back</button></div></section>
        <section className="cloud-share-banner"><div className="cloud-share-banner-icon"><Download size={19} /></div><div><strong>Your files are available</strong><span>Download a single file or prepare the project as a ZIP.</span></div><button className="button button-primary" type="button" onClick={() => void downloadAll()} disabled={!readyCount || downloadBusy !== null}>{downloadBusy === 'all' ? <><LoaderCircle size={15} className="cloud-spin" /> Preparing…</> : <><Download size={15} /> Download all</>}</button></section>
        <section className="cloud-share-file-card"><div className="cloud-share-file-heading"><div><h2>Project files <span>{project.files.length}</span></h2><p>Files are downloaded from the private store through the share API.</p></div><strong>{formatBytes(totalSize)}</strong></div>{project.files.length ? <div className="cloud-public-files">{project.files.map((file) => <div className="cloud-file-row" key={file.id}><FileGlyph file={file} size={16} /><div className="cloud-file-info"><strong>{file.name}</strong><span>{file.relativePath && file.relativePath !== file.name ? file.relativePath : file.type || 'File'} · {formatBytes(file.size)}</span></div><button className="button button-secondary button-sm" type="button" onClick={() => void downloadOne(file)} disabled={downloadBusy !== null || file.available === false}>{downloadBusy === file.id ? <LoaderCircle size={14} className="cloud-spin" /> : <ArrowDownToLine size={14} />} {file.available === false ? 'Unavailable' : 'Download'}</button></div>)}</div> : <div className="cloud-no-public-files">No files are currently available in this share.</div>}<div className="cloud-share-file-note"><Info size={14} /><span>Files are delivered by the owner’s server-side access settings; Vault files are never part of cloud project shares.</span></div></section>
        <aside className="cloud-share-safety"><ShieldCheck size={16} /><span>Only files included in this cloud project are available here. If the link is password protected, file downloads remain gated by the server.</span><span className="cloud-share-expiration">{project.expiresAt ? `Expires ${formatDate(project.expiresAt, true)}` : 'No expiration set'}</span></aside>
      </> : null}
    </div>
    <footer className="cloud-footer"><span>Shared through Sharing · Vault files are separate.</span><a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">Developed by TAREK</a></footer>
  </main>;
}
