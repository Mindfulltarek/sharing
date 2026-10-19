import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, Copy, FilePlus2, FolderOpen, Info, KeyRound, Link2, LockKeyhole, Plus, QrCode, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Project, PrivacyMode } from '../types';
import { formatBytes, newId, hashSecret, shareUrl } from '../services';
import { localShareLinkService } from '../services/adapters';
import { copyText, FileGlyph, localDateTimeValue, Modal, PrivacyBadge, totalSize } from './common';
import { DEMO_LOCKED_PASSWORD } from '../demoData';

const expiryPresets: Array<[string, string]> = [
  ['12h', '12 hours'], ['24h', '24 hours'], ['2d', '2 days'], ['1w', '1 week'], ['1m', '1 month'], ['custom', 'Custom date & time'], ['none', 'No expiration'],
];

function dateTimeInput(value: number) {
  return localDateTimeValue(value);
}

function getExpiration(preset: string, custom: string) {
  const now = Date.now();
  const durations: Record<string, number> = { '12h': 12 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '2d': 2 * 24 * 60 * 60 * 1000, '1w': 7 * 24 * 60 * 60 * 1000, '1m': 30 * 24 * 60 * 60 * 1000 };
  if (preset === 'none') return null;
  if (preset === 'custom') return new Date(custom).getTime();
  return now + (durations[preset] ?? durations['1w']);
}

export function CreateProjectModal({ initialFiles, onClose, onCreate, onOpen, onToast }: {
  initialFiles?: File[];
  onClose: () => void;
  onCreate: (value: { name: string; files: File[]; privacy: PrivacyMode; password?: string; expiresAt: number | null }) => Promise<Project>;
  onOpen: (project: Project) => void;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [name, setName] = useState(() => initialFiles?.[0]?.name.replace(/\.[^.]+$/, '').slice(0, 80) || '');
  const [privacy, setPrivacy] = useState<PrivacyMode>('open');
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('1w');
  const [customDate, setCustomDate] = useState(dateTimeInput(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Project | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const passwordIsValid = /^[a-zA-Z0-9]{4,8}$/.test(password);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...list.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })];
    });
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
  };

  const useSampleFiles = () => {
    const sampleFiles = [
      new File(['# Project brief\n\nA tidy little handoff, ready to share.\n'], 'Project-brief.md', { type: 'text/markdown' }),
      new File(['token,hex\nink,#111018\nviolet,#a78bfa\nrose,#ec4899\n'], 'Palette.csv', { type: 'text/csv' }),
      new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 90"><rect width="180" height="90" rx="16" fill="#21182e"/><circle cx="90" cy="45" r="25" fill="#a78bfa"/><text x="90" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="white">DEMO</text></svg>'], 'Preview.svg', { type: 'image/svg+xml' }),
    ];
    addFiles(sampleFiles);
    if (!name.trim()) setName('My new handoff');
  };

  const validateStep = (current: number) => {
    if (current === 1) {
      if (!name.trim()) { setError('Give your project a name before continuing.'); return false; }
      if (!files.length) { setError('Choose at least one file, or add the sample files to explore the flow.'); return false; }
    }
    if (current === 2) {
      if (privacy === 'password' && !passwordIsValid) { setError('Use 4–8 letters and numbers only for the share password.'); return false; }
      if (expiry === 'custom' && (!Number.isFinite(new Date(customDate).getTime()) || new Date(customDate).getTime() <= Date.now())) { setError('Choose a future date and time for expiration.'); return false; }
    }
    setError('');
    return true;
  };

  const submitProject = async () => {
    if (!validateStep(2)) return;
    setBusy(true);
    try {
      const project = await onCreate({
        name: name.trim(), files, privacy,
        password: privacy === 'password' ? password : undefined,
        expiresAt: getExpiration(expiry, customDate),
      });
      setCreated(project);
      setCreatedPassword(privacy === 'password' ? password : '');
      onToast('Project created', `${project.name} is ready in your local demo workspace.`, 'success');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'The project could not be created. Please try again.');
    } finally { setBusy(false); }
  };

  const copyProjectLink = async () => {
    if (!created?.token) return;
    try { await copyText(shareUrl(created.token)); onToast('Link copied', 'This demo link resolves in the current browser profile.', 'success'); }
    catch { onToast('Could not copy the link', 'Select and copy the link manually.', 'error'); }
  };

  return (
    <Modal onClose={onClose} className={`create-modal${created ? ' create-modal-success' : ''}`} labelledBy="create-project-title">
      {!created ? <>
        <div className="create-modal-header"><div><div className="modal-kicker"><span className="modal-kicker-dot" /> NEW PROJECT</div><h2 id="create-project-title">Create a project</h2><p>Bring a few files together and set how they can be accessed.</p></div><div className="create-step-count">0{step}<span> / 03</span></div></div>
        <div className="create-stepper"><div className={`create-step-line${step >= 2 ? ' step-complete' : ''}`} /><div className={`stepper-item${step >= 1 ? ' stepper-active' : ''}`}><span>{step > 1 ? <Check size={13} /> : '01'}</span><small>Files</small></div><div className={`stepper-item${step >= 2 ? ' stepper-active' : ''}`}><span>{step > 2 ? <Check size={13} /> : '02'}</span><small>Access</small></div><div className={`stepper-item${step >= 3 ? ' stepper-active' : ''}`}><span>03</span><small>Review</small></div></div>
        {step === 1 && <div className="create-step-content">
          <label className="field-label" htmlFor="project-name">Project name <span className="required-star">*</span></label><input id="project-name" className="text-field" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="e.g. Northstar identity kit" maxLength={80} autoFocus />
          <div className="file-picker-heading"><div><label className="field-label">Add files <span className="required-star">*</span></label><p>Files stay in this browser session in demo mode.</p></div><span>{files.length} selected <i>·</i> {formatBytes(total)}</span></div>
          <div className={`file-dropzone${dragging ? ' file-dropzone-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <div className="file-drop-icon"><UploadCloud size={21} /></div><div><strong>Drop files here</strong><span>or choose from your device</span></div><div className="file-drop-actions"><button type="button" className="button button-secondary button-sm" onClick={() => fileRef.current?.click()}>Browse files</button><button type="button" className="button button-quiet button-sm" onClick={() => folderRef.current?.click()}><FolderOpen size={14} /> Choose folder</button></div>
          </div>
          <input ref={fileRef} className="visually-hidden-input" type="file" multiple onChange={(event) => addFiles(event.target.files)} aria-label="Choose project files" />
          <input ref={folderRef} className="visually-hidden-input" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(event) => addFiles(event.target.files)} aria-label="Choose a project folder" />
          {files.length > 0 ? <div className="selected-file-list">{files.map((file, index) => <div className="selected-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><span className="selected-file-symbol"><FilePlus2 size={15} /></span><div><strong>{file.name}</strong><small>{file.webkitRelativePath || file.type || 'File'}</small></div><span className="selected-file-size">{formatBytes(file.size)}</span><button type="button" className="icon-button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={15} /></button></div>)}</div> : <button className="sample-files-link" onClick={useSampleFiles} type="button"><SparkleIcon /> Use a few sample files instead <ArrowRight size={13} /></button>}
          {files.length > 0 && <button className="sample-files-link sample-files-add" onClick={useSampleFiles} type="button"><Plus size={13} /> Add sample files</button>}
          <div className="browser-file-note"><Info size={13} /> Folder access depends on your browser. A website can only access the files you explicitly choose.</div>
        </div>}
        {step === 2 && <div className="create-step-content">
          <div className="field-label">Who can access this project?</div><div className="privacy-choice-grid">
            <button type="button" className={`privacy-choice${privacy === 'open' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('open'); setError(''); }}><span className="privacy-choice-icon choice-open"><Link2 size={17} /></span><span><strong>Link access</strong><small>Anyone with the link</small></span><span className="choice-radio" /></button>
            <button type="button" className={`privacy-choice${privacy === 'password' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('password'); setError(''); }}><span className="privacy-choice-icon choice-password"><LockKeyhole size={17} /></span><span><strong>Password protected</strong><small>Ask for a password first</small></span><span className="choice-radio" /></button>
            <button type="button" className={`privacy-choice${privacy === 'private' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('private'); setError(''); }}><span className="privacy-choice-icon choice-private"><ShieldCheck size={17} /></span><span><strong>Private</strong><small>Only you in this workspace</small></span><span className="choice-radio" /></button>
          </div>
          {privacy === 'password' && <div className="password-field-block"><label className="field-label" htmlFor="share-password">Share password</label><div className="password-input-wrap"><KeyRound size={16} /><input id="share-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)); setError(''); }} placeholder="4–8 letters and numbers" autoComplete="new-password" maxLength={8} /><span>{password.length}/8</span></div><small className="field-hint">Choose 4–8 letters and numbers. Share it separately from the link.</small></div>}
          <div className="expiration-field-block"><div className="field-label">When should this share expire?</div><div className="select-field-wrap"><Clock3 size={16} /><select value={expiry} onChange={(event) => { setExpiry(event.target.value); setError(''); }} aria-label="Project expiration"><optgroup label="Quick presets">{expiryPresets.slice(0, 5).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</optgroup><option value="custom">Custom date &amp; time</option><option value="none">No expiration</option></select><ChevronDown size={14} /></div>{expiry === 'custom' && <input className="text-field custom-date-input" type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Custom expiration date and time" />}</div>
          <div className="expiration-explainer"><Info size={14} /><span>Expiration disables the external demo link. The local project record stays available for re-upload. No cloud copy is stored in this demo.</span></div>
        </div>}
        {step === 3 && <div className="create-step-content review-step">
          <div className="review-success-mark"><Check size={20} /></div><h3>Ready to create your project</h3><p>Take a final look at this handoff before it’s added to the workspace.</p>
          <div className="review-summary"><div className="review-summary-heading"><span className="review-project-icon"><FolderOpen size={18} /></span><div><strong>{name.trim()}</strong><span>{files.length} files <i>·</i> {formatBytes(total)}</span></div></div><div className="review-summary-row"><span>Access</span><strong>{privacy === 'open' ? 'Anyone with the link' : privacy === 'password' ? 'Password required' : 'Private — owner only'}</strong></div>{privacy === 'password' && <div className="review-summary-row"><span>Password</span><strong>Added, shown only to you after creation</strong></div>}<div className="review-summary-row"><span>Expiration</span><strong>{expiry === 'none' ? 'No expiration' : expiry === 'custom' ? new Date(customDate).toLocaleString() : expiryPresets.find(([value]) => value === expiry)?.[1]}</strong></div></div>
          <div className="review-demo-note"><ShieldCheck size={15} /> This creates local demo metadata. File contents are available only in this browser session.</div>
        </div>}
        {error && <div className="modal-inline-error"><AlertTriangle size={15} /> {error}</div>}
        <div className="create-modal-footer">{step > 1 ? <button type="button" className="button button-quiet" onClick={() => { setError(''); setStep(step - 1); }}><ArrowLeft size={15} /> Back</button> : <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>}{step < 3 ? <button type="button" className="button button-primary" onClick={() => { if (validateStep(step)) setStep(step + 1); }}>Continue <ArrowRight size={15} /></button> : <button type="button" className="button button-primary" onClick={submitProject} disabled={busy}>{busy ? <span className="button-spinner" /> : <Check size={16} />}{busy ? 'Creating…' : 'Create project'}</button>}</div>
      </> : <div className="project-created-screen"><div className="success-icon-wrap"><CheckCircle2 size={29} /></div><div className="modal-kicker"><span className="modal-kicker-dot" /> READY TO GO</div><h2 id="create-project-title">Your project is ready.</h2><p className="created-project-name">{created.name}</p><div className="created-project-chips"><span><FilePlus2 size={14} /> {created.files.length} files</span><span>{formatBytes(totalSize(created.files))}</span><PrivacyBadge project={created} compact /></div>
        {created.token ? <div className="created-link-card"><label>YOUR DEMO SHARE LINK</label><div className="created-link-value"><Link2 size={14} /><span>{shareUrl(created.token)}</span><button className="icon-button" onClick={copyProjectLink} aria-label="Copy new project link" title="Copy link"><Copy size={15} /></button></div><p>This link resolves using the project data in this browser profile.</p></div> : <div className="created-private-note"><LockKeyhole size={15} /> This project is private. Change its access settings whenever you’re ready to share.</div>}
        {createdPassword && <div className="created-passcode-note"><KeyRound size={15} /><span><strong>Share password: <code>{createdPassword}</code></strong><small>Keep it private and send it separately from the link. It is not saved as readable text.</small></span></div>}
        {created.token && <div className="created-actions"><button type="button" className="button button-secondary" onClick={() => setQrOpen(!qrOpen)}><QrCode size={15} /> {qrOpen ? 'Hide QR code' : 'Show QR code'}</button><button type="button" className="button button-primary" onClick={() => onOpen(created)}><FolderOpen size={15} /> Open project</button></div>}
        {qrOpen && created.token && <div className="created-qr-wrap"><QRCodeSVG id="created-project-qr" value={shareUrl(created.token)} size={152} level="M" includeMargin bgColor="#ffffff" fgColor="#17131e" /><span>Scan to open this demo share</span></div>}
        {!created.token && <button type="button" className="button button-primary created-open-button" onClick={() => onOpen(created)}><FolderOpen size={15} /> Open project</button>}
        <button className="created-close-link" type="button" onClick={onClose}>Done</button>
      </div>}
    </Modal>
  );
}

export function ShareDialog({ project, onClose, onToast, initialTab = 'link' }: { project: Project; onClose: () => void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void; initialTab?: 'link' | 'qr' }) {
  const link = project.token ? shareUrl(project.token) : '';
  const [tab, setTab] = useState<'link' | 'qr'>(initialTab);
  const expired = project.expiresAt !== null && project.expiresAt <= Date.now();
  const copy = async () => {
    if (!link) return;
    try { await copyText(link); onToast('Link copied', 'This demo link is available in the current browser profile.', 'success'); }
    catch { onToast('Could not copy the link', 'Select and copy the link manually.', 'error'); }
  };
  const downloadQr = () => downloadQrSvg('project-share-qr', `${project.name}-share-qr.svg`);
  return <Modal onClose={onClose} className="share-modal" labelledBy="share-modal-title"><div className="share-modal-header"><div className="share-modal-symbol"><Link2 size={19} /></div><div><div className="modal-kicker">PROJECT SHARING</div><h2 id="share-modal-title">Share {project.name}</h2><p>Manage the link and QR for this project.</p></div></div>
    {expired ? <div className="share-unavailable"><Clock3 size={20} /><strong>This share has expired</strong><span>Re-upload the project to create a fresh demo link.</span></div> : project.privacy === 'private' ? <div className="share-unavailable"><LockKeyhole size={20} /><strong>This project is private</strong><span>Change its access setting before creating a share link.</span></div> : <>
      <div className="share-tabs"><button className={tab === 'link' ? 'share-tab-active' : ''} onClick={() => setTab('link')}><Link2 size={14} /> Link</button><button className={tab === 'qr' ? 'share-tab-active' : ''} onClick={() => setTab('qr')}><QrCode size={14} /> QR code</button></div>
      {tab === 'link' ? <div className="share-link-content"><label className="field-label">DEMO SHARE LINK</label><div className="share-dialog-link"><span>{link}</span><button className="button button-primary button-sm" onClick={copy}><Copy size={14} /> Copy</button></div><div className="share-dialog-security"><PrivacyBadge project={project} compact /><span>{project.expiresAt ? `Expires ${new Date(project.expiresAt).toLocaleDateString()}` : 'No expiration'}</span></div>{project.id === 'demo-kyoto' && project.privacy === 'password' && <div className="demo-passcode-hint"><KeyRound size={14} /><span><strong>Owner-only demo hint</strong> Test this sample link with passcode <code>{DEMO_LOCKED_PASSWORD}</code>.</span></div>}<div className="share-demo-warning"><Info size={14} /><span>Local demo URL: it opens only where this browser’s project data is available. Real cross-device sharing needs a backend.</span></div></div> : <div className="share-qr-content"><div className="qr-paper"><QRCodeSVG id="project-share-qr" value={link} size={190} level="H" includeMargin bgColor="#ffffff" fgColor="#15121b" /></div><h3>Scan to open the project</h3><p>The QR encodes this project’s share URL, not its files.</p><button className="button button-secondary" onClick={downloadQr}><DownloadIcon /> Download QR as SVG</button><button className="qr-copy-link" onClick={copy}><Copy size={13} /> Copy link instead</button></div>}
    </>}
    <div className="share-modal-footer"><span><ShieldCheck size={14} /> Vault files can never be shared.</span><button type="button" className="button button-quiet" onClick={onClose}>Done</button></div>
  </Modal>;
}

export function FilePreviewDialog({ file, blob, onClose, onDownload }: { file: import('../types').ProjectFile; blob: Blob; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textError, setTextError] = useState(false);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = file.type.startsWith('image/') || ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension);
  const isVideo = file.type.startsWith('video/') || ['mp4', 'webm', 'ogv'].includes(extension);
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';
  const isText = ['txt', 'md', 'csv'].includes(extension);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    let live = true;
    if (isText) blob.text().then((text) => { if (live) setTextContent(text); }).catch(() => { if (live) setTextError(true); });
    return () => { live = false; URL.revokeObjectURL(objectUrl); };
  }, [blob, isText]);
  return <Modal onClose={onClose} className="file-preview-modal" labelledBy="file-preview-title"><header className="file-preview-header"><div className="file-preview-heading"><FileGlyph file={file} size={18} /><div><div className="modal-kicker">FILE PREVIEW</div><h2 id="file-preview-title">{file.name}</h2><span>{formatBytes(file.size)} <i>·</i> {file.type || 'File'}</span></div></div><div className="file-preview-header-actions"><button type="button" className="button button-secondary button-sm" onClick={onDownload}><DownloadIcon /> Download</button></div></header><div className="file-preview-stage">{url && isImage && <img src={url} alt={`Preview of ${file.name}`} />}{url && isVideo && <video src={url} controls playsInline aria-label={`Preview video ${file.name}`} />}{url && isPdf && <iframe src={url} title={`PDF preview: ${file.name}`} />}{isText && (textError ? <div className="preview-fallback"><AlertTriangle size={18} /> Could not read this preview. Download the file to open it.</div> : <pre className="file-text-preview">{textContent || 'Loading preview…'}</pre>)}{!isImage && !isVideo && !isPdf && !isText && <div className="preview-fallback"><Info size={18} /> Preview isn’t available for this format. Download the file to open it.</div>}</div><footer className="file-preview-footer"><ShieldCheck size={14} /> Previewed locally in this browser; the file is not uploaded.</footer></Modal>;
}

export function ProjectSettingsModal({ project, onClose, onSave, onToast }:  { project: Project; onClose: () => void; onSave: (next: Project) => void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [name, setName] = useState(project.name);
  const [privacy, setPrivacy] = useState<PrivacyMode>(project.privacy);
  const [newPassword, setNewPassword] = useState('');
  const [expiry, setExpiry] = useState(() => inferPreset(project.expiresAt));
  const [customDate, setCustomDate] = useState(() => dateTimeInput(project.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (privacy === 'password' && !project.passwordHash && !newPassword) { setError('Set a password to protect this project.'); return; }
    if (privacy === 'password' && newPassword && !/^[A-Za-z0-9]{4,8}$/.test(newPassword)) { setError('Use 4–8 letters and numbers only.'); return; }
    if (expiry === 'custom' && (!Number.isFinite(new Date(customDate).getTime()) || new Date(customDate).getTime() <= Date.now())) { setError('Choose a future expiration date.'); return; }
    setBusy(true);
    try {
      const passwordHash = privacy === 'password' ? newPassword ? await hashSecret(newPassword) : project.passwordHash : undefined;
      const updated: Project = {
        ...project, name: name.trim(), privacy, passwordHash,
        token: privacy === 'private' ? null : project.token || localShareLinkService.createToken(),
        expiresAt: getExpiration(expiry, customDate), updatedAt: Date.now(),
      };
      onSave(updated);
      onToast('Settings saved', 'Project access settings were updated in this browser.', 'success');
      onClose();
    } catch { setError('Settings could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal onClose={onClose} className="settings-modal" labelledBy="project-settings-title"><div className="settings-modal-header"><div className="modal-kicker"><span className="modal-kicker-dot" /> PROJECT SETTINGS</div><h2 id="project-settings-title">Sharing settings</h2><p>Change the project name, access type, or expiration.</p></div><form onSubmit={save}>
    <label className="field-label" htmlFor="settings-project-name">Project name</label><input className="text-field" id="settings-project-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
    <div className="field-label settings-access-label">Who can access</div><div className="settings-privacy-options"><button type="button" className={privacy === 'open' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('open')}><Link2 size={16} /><span><strong>Link access</strong><small>Anyone with the link</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'password' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('password')}><LockKeyhole size={16} /><span><strong>Password protected</strong><small>Require a password</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'private' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('private')}><ShieldCheck size={16} /><span><strong>Private</strong><small>Owner only</small></span><span className="choice-radio" /></button></div>
    {privacy === 'password' && <div className="password-field-block"><label className="field-label" htmlFor="settings-new-password">{project.passwordHash ? 'Replace password (optional)' : 'Set a share password'}</label><div className="password-input-wrap"><KeyRound size={15} /><input id="settings-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))} placeholder={project.passwordHash ? 'Leave blank to keep the current one' : '4–8 letters and numbers'} maxLength={8} /></div><small className="field-hint">Your passcode is never displayed publicly or saved as readable text.</small></div>}
    <div className="field-label settings-access-label">Expiration</div><div className="select-field-wrap"><Clock3 size={15} /><select value={expiry} onChange={(event) => setExpiry(event.target.value)} aria-label="Expiration setting">{expiryPresets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} /></div>{expiry === 'custom' && <input className="text-field custom-date-input" type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Custom expiration date" />}
    <div className="settings-modal-notice"><Info size={14} /><span>Changes affect this local demo link only. A production server must enforce privacy and expiration.</span></div>{error && <div className="modal-inline-error"><AlertTriangle size={14} /> {error}</div>}
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'} <ArrowRight size={15} /></button></div>
  </form></Modal>;
}

export function ReuploadModal({ project, onClose, onSave, onToast }: { project: Project; onClose: () => void; onSave: (files: File[]) => void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const updateFiles = (list: FileList | null) => { if (list?.length) { setFiles(Array.from(list)); setError(''); } if (inputRef.current) inputRef.current.value = ''; };
  return <Modal onClose={onClose} className="reupload-modal" labelledBy="reupload-title"><div className="reupload-icon"><UploadCloud size={22} /></div><div className="modal-kicker">DEMO RE-UPLOAD</div><h2 id="reupload-title">Refresh this project</h2><p className="reupload-subtitle">Select the source files again to create a new demo share for <strong>{project.name}</strong>.</p><div className="reupload-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); updateFiles(event.dataTransfer.files); }}><UploadCloud size={20} /><strong>{files.length ? `${files.length} files selected` : 'Choose files to re-upload'}</strong><span>{files.length ? formatBytes(total) : 'The new local share will be active for 7 days.'}</span><button type="button" className="button button-secondary button-sm">Browse files</button></div><input ref={inputRef} type="file" multiple className="visually-hidden-input" onChange={(event) => updateFiles(event.target.files)} aria-label="Choose re-upload files" />{files.length > 0 && <div className="reupload-selected">{files.slice(0, 3).map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}{files.length > 3 && <span>+{files.length - 3} more</span>}</div>}{error && <div className="modal-inline-error"><AlertTriangle size={14} /> {error}</div>}<div className="reupload-warning"><Info size={14} /> Demo behavior: this does not contact a storage provider or restore server-side files.</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="button" className="button button-primary" onClick={() => { if (!files.length) { setError('Select at least one source file.'); return; } onSave(files); onToast('Project re-uploaded', 'A fresh 7-day demo share is ready.', 'success'); onClose(); }} disabled={!files.length}><CloudIcon /> Re-upload</button></div></Modal>;
}

export function ConfirmDialog({ title, body, confirmLabel, destructive = false, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal onClose={onClose} className="confirm-modal" labelledBy="confirm-dialog-title"><div className={`confirm-icon${destructive ? ' confirm-icon-danger' : ''}`}>{destructive ? <AlertTriangle size={21} /> : <Info size={21} />}</div><h2 id="confirm-dialog-title">{title}</h2><p>{body}</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="button" className={`button ${destructive ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>{confirmLabel}</button></div></Modal>;
}

export function GoogleInfoModal({ onClose }: { onClose: () => void }) {
  return <Modal onClose={onClose} className="integration-modal" labelledBy="google-info-title"><div className="integration-modal-icon"><KeyRound size={21} /></div><div className="modal-kicker">FUTURE INTEGRATION</div><h2 id="google-info-title">Google sign-in is coming later.</h2><p>Sharing is intentionally open in local demo mode. When authentication is added, it should sit behind an AuthService interface so the project and Vault experience does not need to be rebuilt.</p><div className="integration-roadmap"><div><span>01</span><strong>Configure OAuth consent and redirect URIs</strong></div><div><span>02</span><strong>Use a server-side session and protect API routes</strong></div><div><span>03</span><strong>Keep storage credentials off the client</strong></div></div><div className="integration-modal-note"><Info size={14} /> No Google account, token, or API key is connected in this version.</div><div className="modal-actions"><button type="button" className="button button-primary" onClick={onClose}>Got it <Check size={15} /></button></div></Modal>;
}

function inferPreset(timestamp: number | null) {
  if (!timestamp) return 'none';
  const remaining = timestamp - Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (remaining <= 13 * 60 * 60 * 1000 && remaining > 0) return '12h';
  if (remaining <= 25 * 60 * 60 * 1000 && remaining > 13 * 60 * 60 * 1000) return '24h';
  if (remaining <= 2.2 * day && remaining > 25 * 60 * 60 * 1000) return '2d';
  if (remaining <= 8 * day && remaining > 2.2 * day) return '1w';
  if (remaining <= 31 * day && remaining > 8 * day) return '1m';
  return 'custom';
}

function downloadQrSvg(elementId: string, fileName: string) {
  const svg = document.getElementById(elementId);
  if (!svg) return;
  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.replace(/[^\w.-]/g, '-');
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DownloadIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>; }
function CloudIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 16.2A4.5 4.5 0 0 0 18 7.5 6 6 0 0 0 6.3 8.7 4.1 4.1 0 0 0 6 17h12"/><path d="M12 12v8m-3-3 3 3 3-3"/></svg>; }
function SparkleIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>; }
