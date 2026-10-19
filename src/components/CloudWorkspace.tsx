import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { ArrowDownToLine, ArrowRight, Clock3, Cloud, Copy, ExternalLink, FilePlus2, FolderOpen, HardDrive, Link2, LoaderCircle, LockKeyhole, LogOut, Plus, RefreshCw, RotateCw, Search, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import type { Project, ProjectFile, PrivacyMode } from '../types';
import { CloudApiError, cloudApi, setGoogleIdToken } from '../services/cloudApi';
import { downloadBlob, formatBytes, formatDate, shareUrl } from '../services';
import { ConfirmDialog } from './Dialogs';
import { copyText, FileGlyph, Logo, Modal, PrivacyBadge } from './common';

interface CloudWorkspaceProps {
  accountEmail?: string;
  onHome: () => void;
  onLocalWorkspace: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
  onOpenShare: (token: string) => void;
}

const filePath = (file: File) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
const safeFileName = (value: string) => (value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || 'project');
const messageFor = (error: unknown) => error instanceof CloudApiError ? error.message : error instanceof Error ? error.message : 'The request could not be completed.';

export default function CloudWorkspace({ accountEmail, onHome, onLocalWorkspace, onSignIn, onSignOut, onToast, onOpenShare }: CloudWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [rotateTarget, setRotateTarget] = useState<Project | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyMode>('open');
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('7d');
  const [createError, setCreateError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setAuthRequired(false);
    try {
      setProjects(await cloudApi.listProjects());
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 401) setAuthRequired(true);
      else setLoadError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(normalized) || project.files.some((file) => file.name.toLowerCase().includes(normalized)));
  }, [projects, query]);

  const openCreate = () => {
    setName(''); setFiles([]); setPrivacy('open'); setPassword(''); setExpiry('7d'); setCreateError(''); setUploadProgress(''); setCreateOpen(true);
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((current) => [...current, ...Array.from(list)]);
    setCreateError('');
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!name.trim()) { setCreateError('Enter a project name.'); return; }
    if (!files.length) { setCreateError('Choose at least one file or folder.'); return; }
    if (privacy === 'password' && password.length < 8) { setCreateError('Use at least 8 letters or numbers for the share password.'); return; }

    setBusyAction('create');
    let created: Project | null = null;
    try {
      const expiresAt = expiry === 'none' ? null : Date.now() + Number.parseInt(expiry, 10) * 24 * 60 * 60 * 1000;
      created = await cloudApi.createProject({ name: name.trim(), privacy, expiresAt, ...(privacy === 'password' ? { password } : {}) });
      let latest = created;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setUploadProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        latest = await cloudApi.uploadProjectFile(created.id, file, filePath(file));
      }
      setProjects((current) => [latest, ...current.filter((project) => project.id !== latest.id)]);
      setCreateOpen(false);
      setExpanded(latest.id);
      setFiles([]);
      onToast('Cloud project created', `${latest.files.length} ${latest.files.length === 1 ? 'file is' : 'files are'} uploaded and available to this Google account.`, 'success');
      if (privacy === 'password') onToast('Keep the share password', 'Share it with recipients separately from the link. It cannot be retrieved from this screen later.', 'info');
    } catch (error) {
      const message = messageFor(error);
      if (created) {
        try {
          await cloudApi.deleteProject(created.id);
          setProjects((current) => current.filter((project) => project.id !== created!.id));
        } catch {
          // Preserve partial state if cleanup also fails; refresh below will show what reached the server.
          try {
            const partial = await cloudApi.getProject(created.id);
            setProjects((current) => [partial, ...current.filter((project) => project.id !== partial.id)]);
          } catch { /* A failed upload can be accompanied by a failed metadata lookup. */ }
        }
      }
      setCreateError(`The cloud upload did not finish. ${message} ${created ? 'Any incomplete project was removed where possible; check the project list before retrying.' : ''}`.trim());
    } finally {
      setBusyAction(null);
      setUploadProgress('');
    }
  };

  const downloadFile = async (project: Project, file: ProjectFile) => {
    const id = `download:${project.id}:${file.id}`;
    setBusyAction(id);
    try {
      const blob = await cloudApi.downloadProjectFile(project.id, file.id);
      downloadBlob(blob, file.name);
      onToast('Download started', file.name, 'success');
    } catch (error) {
      onToast('Download failed', messageFor(error), 'error');
    } finally { setBusyAction(null); }
  };

  const downloadZip = async (project: Project) => {
    const id = `zip:${project.id}`;
    setBusyAction(id);
    try {
      const zip = new JSZip();
      for (const file of project.files) {
        if (file.available === false) continue;
        const blob = await cloudApi.downloadProjectFile(project.id, file.id);
        zip.file(file.relativePath || file.name, blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${safeFileName(project.name)}.zip`);
      onToast('Project ZIP ready', `${project.files.length} files added to the archive.`, 'success');
    } catch (error) {
      onToast('Could not create the ZIP', messageFor(error), 'error');
    } finally { setBusyAction(null); }
  };

  const copyLink = async (project: Project) => {
    if (!project.token) return;
    try {
      await copyText(shareUrl(project.token));
      onToast('Cloud link copied', 'This link is served by the public share API.', 'success');
    } catch {
      onToast('Could not copy the link', shareUrl(project.token), 'info');
    }
  };

  const rotateLink = async () => {
    if (!rotateTarget) return;
    const project = rotateTarget;
    setBusyAction(`rotate:${project.id}`);
    try {
      const { token } = await cloudApi.rotateShareLink(project.id);
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, token } : item));
      setRotateTarget(null);
      onToast('Share link replaced', 'The old link is no longer valid. Copy the new link before sharing again.', 'success');
    } catch (error) { onToast('Could not replace the link', messageFor(error), 'error'); }
    finally { setBusyAction(null); }
  };

  const deleteProject = async () => {
    if (!deleteTarget) return;
    const project = deleteTarget;
    setBusyAction(`delete:${project.id}`);
    try {
      await cloudApi.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setDeleteTarget(null);
      onToast('Cloud project deleted', 'The project record and its stored files were removed by the server.', 'success');
    } catch (error) { onToast('Could not delete the project', messageFor(error), 'error'); }
    finally { setBusyAction(null); }
  };

  const signOut = () => {
    setGoogleIdToken(null);
    onSignOut();
    onToast('Signed out', 'The local browser workspace and Vault remain separate.', 'info');
    onHome();
  };

  const totalFiles = projects.reduce((sum, project) => sum + project.files.length, 0);
  const totalBytes = projects.reduce((sum, project) => sum + project.files.reduce((fileSum, file) => fileSum + file.size, 0), 0);

  return (
    <main className="cloud-page">
      <header className="cloud-topbar">
        <button className="cloud-brand" type="button" onClick={onHome} aria-label="Back to Sharing"><Logo /></button>
        <div className="cloud-top-actions"><span className="cloud-account"><span className="cloud-account-dot" />{accountEmail || 'Google account'}</span><button className="button button-secondary button-sm" type="button" onClick={onLocalWorkspace}><HardDrive size={14} /> Local workspace</button><button className="icon-button cloud-signout" type="button" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
      </header>

      <div className="cloud-content">
        <section className="cloud-hero">
          <div className="cloud-hero-copy"><div className="cloud-eyebrow"><span><Cloud size={14} /></span> GOOGLE ACCOUNT WORKSPACE</div><h1>Your cloud projects.</h1><p>Files you upload here are sent through the Cloud API and stored in the connected private Blob store. This workspace does not include Vault files.</p></div>
          <div className="cloud-hero-actions"><button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'cloud-spin' : ''} /> Refresh</button><button className="button button-primary" type="button" onClick={openCreate}><Plus size={16} /> New cloud project</button></div>
          <div className="cloud-metrics"><div><span>Projects</span><strong>{projects.length}</strong></div><div><span>Files</span><strong>{totalFiles}</strong></div><div><span>Uploaded data</span><strong>{formatBytes(totalBytes)}</strong></div><div className="cloud-metrics-note"><ShieldCheck size={15} /> Metadata and file bytes are kept separate from the local workspace.</div></div>
        </section>

        <section className="cloud-notice"><div className="cloud-notice-icon"><InfoIcon /></div><p><strong>Local projects stay local.</strong> Projects created before this cloud workspace was connected are not copied automatically. To make one shareable across devices, add its original files as a new cloud project here.</p><button type="button" className="cloud-notice-link" onClick={onLocalWorkspace}>Open local workspace <ArrowRight size={14} /></button></section>

        <section className="cloud-project-section" aria-labelledby="cloud-projects-title">
          <div className="cloud-section-head"><div><div className="cloud-section-kicker">YOUR ACCOUNT</div><h2 id="cloud-projects-title">Projects <span>{filteredProjects.length}</span></h2></div><label className="cloud-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or files" aria-label="Search cloud projects" /></label></div>

          {loading && projects.length === 0 ? <div className="cloud-state-card"><LoaderCircle size={22} className="cloud-spin" /><strong>Loading your cloud projects…</strong><span>Checking this Google account with the server.</span></div> : authRequired ? <div className="cloud-state-card cloud-state-error"><LockKeyhole size={23} /><strong>Sign in to open cloud projects</strong><span>Your Google session is not available in this browser tab. Sign in again to load your account’s files.</span><button className="button button-primary" type="button" onClick={onSignIn}>Sign in with Google <ArrowRight size={15} /></button></div> : loadError ? <div className="cloud-state-card cloud-state-error"><Cloud size={24} /><strong>Cloud projects could not be loaded</strong><span>{loadError}</span><button className="button button-secondary" type="button" onClick={() => void refresh()}><RefreshCw size={14} /> Try again</button></div> : filteredProjects.length === 0 ? <div className="cloud-empty"><div className="cloud-empty-icon"><FolderOpen size={22} /></div><h3>{query ? 'No matching projects.' : 'Your cloud workspace is ready.'}</h3><p>{query ? 'Try another project or file name.' : 'Create a cloud project and upload the source files to make a share link that works on other devices.'}</p>{!query && <button className="button button-primary" type="button" onClick={openCreate}><UploadCloud size={15} /> Upload your first project</button>}</div> : <div className="cloud-project-list">{filteredProjects.map((project) => {
            const isExpanded = expanded === project.id;
            const zipBusy = busyAction === `zip:${project.id}`;
            return <article className="cloud-project-card" key={project.id}>
              <div className="cloud-project-main"><div className="cloud-project-symbol"><FolderOpen size={19} /></div><div className="cloud-project-info"><div className="cloud-project-title-row"><h3>{project.name}</h3><PrivacyBadge project={project} compact /></div><div className="cloud-project-meta"><span>{project.files.length} {project.files.length === 1 ? 'file' : 'files'}</span><i>·</i><span>{formatBytes(project.files.reduce((sum, file) => sum + file.size, 0))}</span><i>·</i><span>Updated {formatDate(project.updatedAt)}</span>{project.expiresAt && <><i>·</i><span><Clock3 size={12} /> Expires {formatDate(project.expiresAt)}</span></>}</div></div><button className="button button-quiet button-sm cloud-expand" type="button" onClick={() => setExpanded(isExpanded ? null : project.id)} aria-expanded={isExpanded}>{isExpanded ? 'Hide files' : 'View files'} <ArrowRight size={13} className={isExpanded ? 'cloud-chevron-open' : ''} /></button></div>
              <div className="cloud-project-actions">{project.token && <><button type="button" className="button button-secondary button-sm" onClick={() => void copyLink(project)}><Copy size={14} /> Copy share link</button><button type="button" className="button button-quiet button-sm" onClick={() => onOpenShare(project.token!)}><ExternalLink size={14} /> Open share page</button></>}{project.privacy !== 'private' && <button type="button" className="button button-quiet button-sm" onClick={() => setRotateTarget(project)}><RotateCw size={14} /> Replace link</button>}{project.files.length > 0 && <button type="button" className="button button-quiet button-sm" onClick={() => void downloadZip(project)} disabled={zipBusy}><ArrowDownToLine size={14} /> {zipBusy ? 'Preparing ZIP…' : 'Download ZIP'}</button>}<button type="button" className="button button-quiet button-sm cloud-delete-action" onClick={() => setDeleteTarget(project)}><Trash2 size={14} /> Delete</button></div>
              {isExpanded && <div className="cloud-file-list">{project.files.length ? project.files.map((file) => <div className="cloud-file-row" key={file.id}><FileGlyph file={file} size={16} /><div className="cloud-file-info"><strong>{file.name}</strong><span>{file.relativePath && file.relativePath !== file.name ? file.relativePath : file.type || 'File'} · {formatBytes(file.size)}</span></div><button className="button button-secondary button-sm" type="button" onClick={() => void downloadFile(project, file)} disabled={busyAction === `download:${project.id}:${file.id}` || file.available === false}>{busyAction === `download:${project.id}:${file.id}` ? <LoaderCircle size={14} className="cloud-spin" /> : <ArrowDownToLine size={14} />} Download</button></div>) : <p className="cloud-no-files">No files have been uploaded to this project yet.</p>}</div>}
            </article>;
          })}</div>}
        </section>
      </div>

      <footer className="cloud-footer"><span>Private cloud projects · Local workspace stays available without sign-in.</span><a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">Developed by TAREK</a></footer>

      {createOpen && <Modal onClose={() => { if (busyAction !== 'create') setCreateOpen(false); }} className="cloud-create-modal" labelledBy="cloud-create-title"><button className="icon-button modal-close" type="button" onClick={() => busyAction !== 'create' && setCreateOpen(false)} aria-label="Close dialog"><X size={18} /></button><div className="cloud-create-symbol"><UploadCloud size={21} /></div><div className="modal-kicker">CLOUD PROJECT</div><h2 id="cloud-create-title">Upload a project.</h2><p className="cloud-create-subtitle">Choose the files you want to store and share. Vault files are not shown here and cannot be added through this form.</p><form onSubmit={(event) => void createProject(event)}>
        <label className="field-label" htmlFor="cloud-project-name">Project name</label><input id="cloud-project-name" className="text-field" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Brand handoff" disabled={busyAction === 'create'} />
        <div className="cloud-file-picker-head"><div><span className="field-label">Project files</span><small>Select files or a folder from your device.</small></div><span>{files.length} selected · {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</span></div>
        <div className="cloud-file-picker"><div className="cloud-picker-icon"><FilePlus2 size={20} /></div><div><strong>{files.length ? `${files.length} files selected` : 'Choose source files'}</strong><span>Files upload directly to your connected Private Blob store.</span></div><div className="cloud-picker-actions"><button className="button button-secondary button-sm" type="button" onClick={() => fileInputRef.current?.click()} disabled={busyAction === 'create'}>Browse files</button><button className="button button-quiet button-sm" type="button" onClick={() => folderInputRef.current?.click()} disabled={busyAction === 'create'}><FolderOpen size={14} /> Choose folder</button></div></div>
        <input ref={fileInputRef} className="visually-hidden-input" type="file" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} aria-label="Choose cloud project files" />
        <input ref={folderInputRef} className="visually-hidden-input" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} aria-label="Choose a cloud project folder" />
        {files.length > 0 && <div className="cloud-selected-files">{files.map((file, index) => <div className="cloud-selected-file" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><span>{filePath(file)}</span><small>{formatBytes(file.size)}</small><button type="button" className="icon-button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} disabled={busyAction === 'create'} aria-label={`Remove ${file.name}`}><X size={14} /></button></div>)}</div>}
        <div className="cloud-form-divider" />
        <div className="field-label">Who can access this project?</div><div className="cloud-access-options"><button type="button" className={privacy === 'open' ? 'cloud-access-choice cloud-choice-selected' : 'cloud-access-choice'} onClick={() => setPrivacy('open')} disabled={busyAction === 'create'}><Link2 size={16} /><span><strong>Link access</strong><small>Anyone with the link</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'password' ? 'cloud-access-choice cloud-choice-selected' : 'cloud-access-choice'} onClick={() => setPrivacy('password')} disabled={busyAction === 'create'}><LockKeyhole size={16} /><span><strong>Password protected</strong><small>Requires a separate password</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'private' ? 'cloud-access-choice cloud-choice-selected' : 'cloud-access-choice'} onClick={() => setPrivacy('private')} disabled={busyAction === 'create'}><ShieldCheck size={16} /><span><strong>Private</strong><small>Owner only; no share link</small></span><span className="choice-radio" /></button></div>
        {privacy === 'password' && <div className="cloud-password-block"><label className="field-label" htmlFor="cloud-share-password">Share password</label><input className="text-field" id="cloud-share-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 64))} minLength={8} placeholder="At least 8 letters or numbers" disabled={busyAction === 'create'} /><small className="field-hint">Give recipients this password separately. It is never stored as readable text.</small></div>}
        <label className="field-label cloud-expiry-label" htmlFor="cloud-expiry">Link expiration</label><select className="text-field cloud-expiry-select" id="cloud-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={busyAction === 'create'}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="none">No expiration</option></select>
        <div className="cloud-storage-note"><ShieldCheck size={14} /><span>File contents are uploaded through the signed server flow and are not saved in browser storage. You can download the files again from this account on another device.</span></div>
        {createError && <div className="modal-inline-error" role="alert">{createError}</div>}{uploadProgress && <div className="cloud-upload-progress" role="status"><LoaderCircle size={14} className="cloud-spin" />{uploadProgress}</div>}
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setCreateOpen(false)} disabled={busyAction === 'create'}>Cancel</button><button type="submit" className="button button-primary" disabled={busyAction === 'create'}>{busyAction === 'create' ? <><LoaderCircle size={15} className="cloud-spin" /> Uploading…</> : <><Cloud size={15} /> Create cloud project</>}</button></div>
      </form></Modal>}

      {deleteTarget && <ConfirmDialog title={`Delete “${deleteTarget.name}”?`} body="The server will delete this project and its Blob files. Any share link will stop working. This cannot be undone." confirmLabel="Delete cloud project" destructive onClose={() => setDeleteTarget(null)} onConfirm={() => void deleteProject()} />}
      {rotateTarget && <ConfirmDialog title="Replace this share link?" body="The existing link will stop working immediately. Create a new link only if the current one has been exposed or needs to be revoked." confirmLabel="Replace link" onClose={() => setRotateTarget(null)} onConfirm={() => void rotateLink()} />}
    </main>
  );
}

function InfoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>;
}
