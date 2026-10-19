import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, Copy, FilePlus2, FolderOpen, Info, KeyRound, Link2, LockKeyhole, QrCode, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Project, PrivacyMode } from '../types';
import { formatBytes, formatDate, shareUrl } from '../services';
import { copyText, FileGlyph, localDateTimeValue, Modal, PrivacyBadge, totalSize } from './common';
import { useLanguage } from '../i18n';

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
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const passwordIsValid = /^[a-zA-Z0-9]{8,64}$/.test(password);

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

  const validateStep = (current: number) => {
    if (current === 1) {
      if (!name.trim()) { setError('Give your project a name before continuing.'); return false; }
      if (!files.length) { setError('Choose at least one file before continuing.'); return false; }
    }
    if (current === 2) {
      if (privacy === 'password' && !passwordIsValid) { setError('Use at least 8 letters or numbers for the cloud share password.'); return false; }
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
      onToast(t('Cloud project created'), t('The project and its selected files were uploaded to the connected cloud storage.'), 'success');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'The project could not be created. Please try again.');
    } finally { setBusy(false); }
  };

  const copyProjectLink = async () => {
    if (!created?.token) return;
    try { await copyText(shareUrl(created.token)); onToast(t('Link copied'), t('This cloud link can open on another device after Google sign-in.'), 'success'); }
    catch { onToast(t('Could not copy the link'), t('Select and copy the link manually.'), 'error'); }
  };

  return (
    <Modal onClose={onClose} onFilesDrop={(dropped) => addFiles(dropped)} className={`create-modal${created ? ' create-modal-success' : ''}`} labelledBy="create-project-title">
      {!created ? <>
        <div className="create-modal-header"><div><div className="modal-kicker"><span className="modal-kicker-dot" /> {t('NEW PROJECT')}</div><h2 id="create-project-title">{t('Create a project')}</h2><p>{t('Bring a few files together and set how they can be accessed.')}</p></div><div className="create-step-count">0{step}<span> / 03</span></div></div>
        <div className="create-stepper"><div className={`create-step-line${step >= 2 ? ' step-complete' : ''}`} /><div className={`stepper-item${step >= 1 ? ' stepper-active' : ''}`}><span>{step > 1 ? <Check size={13} /> : '01'}</span><small>{t('Files')}</small></div><div className={`stepper-item${step >= 2 ? ' stepper-active' : ''}`}><span>{step > 2 ? <Check size={13} /> : '02'}</span><small>{t('Access')}</small></div><div className={`stepper-item${step >= 3 ? ' stepper-active' : ''}`}><span>03</span><small>{t('Review')}</small></div></div>
        {step === 1 && <div className="create-step-content">
          <label className="field-label" htmlFor="project-name">{t('Project name')} <span className="required-star">*</span></label><input id="project-name" className="text-field" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder={t('e.g. Brand assets for review')} maxLength={80} autoFocus />
          <div className="file-picker-heading"><div><label className="field-label">{t('Add files')} <span className="required-star">*</span></label><p>{t('Selected files upload to your connected cloud storage after you create the project.')}</p></div><span>{t('{count} selected', { count: files.length })} <i>·</i> {formatBytes(total)}</span></div>
          <div className={`file-dropzone${dragging ? ' file-dropzone-active' : ''}`} onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setDragging(true); }} onDragLeave={(event) => { if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return; setDragging(false); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <div className="file-drop-icon"><UploadCloud size={21} /></div><div><strong>{t('Drop files here')}</strong><span>{t('or choose from your device')}</span></div><div className="file-drop-actions"><button type="button" className="button button-secondary button-sm" onClick={() => fileRef.current?.click()}>{t('Browse files')}</button><button type="button" className="button button-quiet button-sm" onClick={() => folderRef.current?.click()}><FolderOpen size={14} /> {t('Choose folder')}</button></div>
          </div>
          <input ref={fileRef} className="visually-hidden-input" type="file" multiple onChange={(event) => addFiles(event.target.files)} aria-label={t('Choose project files')} />
          <input ref={folderRef} className="visually-hidden-input" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(event) => addFiles(event.target.files)} aria-label={t('Choose a project folder')} />
          {files.length > 0 && <div className="selected-file-list">{files.map((file, index) => <div className="selected-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><span className="selected-file-symbol"><FilePlus2 size={15} /></span><div><strong title={file.name}>{file.name}</strong><small title={file.webkitRelativePath || file.type || t('File')}>{file.webkitRelativePath || file.type || t('File')}</small></div><span className="selected-file-size">{formatBytes(file.size)}</span><button type="button" className="icon-button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={t('Remove {name}', { name: file.name })}><X size={15} /></button></div>)}</div>}
          <div className="browser-file-note"><Info size={13} /> {t('Folder access depends on your browser. A website can only access the files you explicitly choose.')}</div>
        </div>}
        {step === 2 && <div className="create-step-content">
          <div className="field-label">{t('Who can access this project?')}</div><div className="privacy-choice-grid">
            <button type="button" className={`privacy-choice${privacy === 'open' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('open'); setError(''); }}><span className="privacy-choice-icon choice-open"><Link2 size={17} /></span><span><strong>{t('Link access')}</strong><small>{t('Anyone with the link')}</small></span><span className="choice-radio" /></button>
            <button type="button" className={`privacy-choice${privacy === 'password' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('password'); setError(''); }}><span className="privacy-choice-icon choice-password"><LockKeyhole size={17} /></span><span><strong>{t('Password protected')}</strong><small>{t('Ask for a password first')}</small></span><span className="choice-radio" /></button>
            <button type="button" className={`privacy-choice${privacy === 'private' ? ' privacy-choice-selected' : ''}`} onClick={() => { setPrivacy('private'); setError(''); }}><span className="privacy-choice-icon choice-private"><ShieldCheck size={17} /></span><span><strong>{t('Private')}</strong><small>{t('Only you in your Google account')}</small></span><span className="choice-radio" /></button>
          </div>
          {privacy === 'password' && <div className="password-field-block"><label className="field-label" htmlFor="share-password">{t('Share password')}</label><div className="password-input-wrap"><KeyRound size={16} /><input id="share-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64)); setError(''); }} placeholder={t('At least 8 letters or numbers')} autoComplete="new-password" maxLength={64} /><span>{password.length}/64</span></div><small className="field-hint">{t('Use at least 8 characters. Share the password separately from the cloud link.')}</small></div>}
          <div className="expiration-field-block"><div className="field-label">{t('When should this share expire?')}</div><div className="select-field-wrap"><Clock3 size={16} /><select value={expiry} onChange={(event) => { setExpiry(event.target.value); setError(''); }} aria-label={t('Project expiration')}><optgroup label={t('Quick presets')}>{expiryPresets.slice(0, 5).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</optgroup><option value="custom">{t('Custom date & time')}</option><option value="none">{t('No expiration')}</option></select><ChevronDown size={14} /></div>{expiry === 'custom' && <input className="text-field custom-date-input" type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label={t('Custom expiration date and time')} />}</div>
          <div className="expiration-explainer"><Info size={14} /><span>{t('The server blocks cloud links when they expire; scheduled cleanup may remove stored files later.')}</span></div>
        </div>}
        {step === 3 && <div className="create-step-content review-step">
          <div className="review-success-mark"><Check size={20} /></div><h3>{t('Ready to create your project')}</h3><p>{t('Take a final look at this handoff before it’s added to the workspace.')}</p>
          <div className="review-summary"><div className="review-summary-heading"><span className="review-project-icon"><FolderOpen size={18} /></span><div><strong>{name.trim()}</strong><span>{t('{count} files', { count: files.length })} <i>·</i> {formatBytes(total)}</span></div></div><div className="review-summary-row"><span>{t('Access')}</span><strong>{privacy === 'open' ? t('Anyone with the link') : privacy === 'password' ? t('Password required') : t('Private — owner only')}</strong></div>{privacy === 'password' && <div className="review-summary-row"><span>{t('Password')}</span><strong>{t('Added, shown only to you after creation')}</strong></div>}<div className="review-summary-row"><span>{t('Expiration')}</span><strong>{expiry === 'none' ? t('No expiration') : expiry === 'custom' ? formatDate(new Date(customDate).getTime(), true) : t(expiryPresets.find(([value]) => value === expiry)?.[1] || 'Custom date & time')}</strong></div></div>
          <div className="review-info-note"><ShieldCheck size={15} /> {t('This uploads selected files to your account cloud storage. Vault files are separate and are not included.')}</div>
        </div>}
        {error && <div className="modal-inline-error"><AlertTriangle size={15} /> {t(error)}</div>}
        <div className="create-modal-footer">{step > 1 ? <button type="button" className="button button-quiet" onClick={() => { setError(''); setStep(step - 1); }}><ArrowLeft size={15} /> {t('Back')}</button> : <button type="button" className="button button-quiet" onClick={onClose}>{t('Cancel')}</button>}{step < 3 ? <button type="button" className="button button-primary" onClick={() => { if (validateStep(step)) setStep(step + 1); }}>{t('Continue')} <ArrowRight size={15} /></button> : <button type="button" className="button button-primary" onClick={submitProject} disabled={busy}>{busy ? <span className="button-spinner" /> : <Check size={16} />}{busy ? t('Creating…') : t('Create project')}</button>}</div>
      </> : <div className="project-created-screen"><div className="success-icon-wrap"><CheckCircle2 size={29} /></div><div className="modal-kicker"><span className="modal-kicker-dot" /> {t('READY TO GO')}</div><h2 id="create-project-title">{t('Your project is ready.')}</h2><p className="created-project-name">{created.name}</p><div className="created-project-chips"><span><FilePlus2 size={14} /> {t('{count} files', { count: created.files.length })}</span><span>{formatBytes(totalSize(created.files))}</span><PrivacyBadge project={created} compact /></div>
        {created.token ? <div className="created-link-card"><label>{t('YOUR CLOUD SHARE LINK')}</label><div className="created-link-value"><Link2 size={14} /><span>{shareUrl(created.token)}</span><button className="icon-button" onClick={copyProjectLink} aria-label={t('Copy new project link')} title={t('Copy link')}><Copy size={15} /></button></div><p>{t('This link is served by the Cloud API and can open on another device after Google sign-in.')}</p></div> : <div className="created-private-note"><LockKeyhole size={15} /> {t('This project is private. Change its access settings whenever you’re ready to share.')}</div>}
        {createdPassword && <div className="created-passcode-note"><KeyRound size={15} /><span><strong>{t('Share password')}: <code>{createdPassword}</code></strong><small>{t('Keep it private and send it separately from the link. It is not saved as readable text.')}</small></span></div>}
        {created.token && <div className="created-actions"><button type="button" className="button button-secondary" onClick={() => setQrOpen(!qrOpen)}><QrCode size={15} /> {qrOpen ? t('Hide QR code') : t('Show QR code')}</button><button type="button" className="button button-primary" onClick={() => onOpen(created)}><FolderOpen size={15} /> {t('Open project')}</button></div>}
        {qrOpen && created.token && <div className="created-qr-wrap"><QRCodeSVG id="created-project-qr" value={shareUrl(created.token)} size={152} level="M" includeMargin bgColor="#ffffff" fgColor="#17131e" /><span>{t('Scan to open this cloud share')}</span></div>}
        {!created.token && <button type="button" className="button button-primary created-open-button" onClick={() => onOpen(created)}><FolderOpen size={15} /> {t('Open project')}</button>}
        <button className="created-close-link" type="button" onClick={onClose}>{t('Done')}</button>
      </div>}
    </Modal>
  );
}

export function ShareDialog({ project, onClose, onToast, initialTab = 'link' }: { project: Project; onClose: () => void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void; initialTab?: 'link' | 'qr' }) {
  const link = project.token ? shareUrl(project.token) : '';
  const [tab, setTab] = useState<'link' | 'qr'>(initialTab);
  const { t } = useLanguage();
  const expired = project.expiresAt !== null && project.expiresAt <= Date.now();
  const copy = async () => {
    if (!link) return;
    try { await copyText(link); onToast(t('Link copied'), t('This cloud link can open on another device after Google sign-in.'), 'success'); }
    catch { onToast(t('Could not copy the link'), t('Select and copy the link manually.'), 'error'); }
  };
  const downloadQr = () => downloadQrSvg('project-share-qr', `${project.name}-share-qr.svg`);
  return <Modal onClose={onClose} className="share-modal" labelledBy="share-modal-title"><div className="share-modal-header"><div className="share-modal-symbol"><Link2 size={19} /></div><div><div className="modal-kicker">{t('PROJECT SHARING')}</div><h2 id="share-modal-title">{t('Share')} {project.name}</h2><p>{t('Manage the link and QR for this project.')}</p></div></div>
    {expired ? <div className="share-unavailable"><Clock3 size={20} /><strong>{t('This share has expired')}</strong><span>{t('Update its expiry in Settings if the cloud files remain available.')}</span></div> : project.privacy === 'private' ? <div className="share-unavailable"><LockKeyhole size={20} /><strong>{t('This project is private')}</strong><span>{t('Change its access setting before creating a share link.')}</span></div> : <>
      <div className="share-tabs"><button className={tab === 'link' ? 'share-tab-active' : ''} onClick={() => setTab('link')}><Link2 size={14} /> {t('Link')}</button><button className={tab === 'qr' ? 'share-tab-active' : ''} onClick={() => setTab('qr')}><QrCode size={14} /> {t('QR code')}</button></div>
      {tab === 'link' ? <div className="share-link-content"><label className="field-label">{t('CLOUD SHARE LINK')}</label><div className="share-dialog-link"><span>{link}</span><button className="button button-primary button-sm" onClick={copy}><Copy size={14} /> {t('Copy')}</button></div><div className="share-dialog-security"><PrivacyBadge project={project} compact /><span>{project.expiresAt ? t('Expires {date}', { date: formatDate(project.expiresAt) }) : t('No expiration')}</span></div><div className="share-link-note"><Info size={14} /><span>{t('Cloud URL: this share is checked by the server; password-protected shares reveal no file details before verification. Google sign-in is required to open it.')}</span></div></div> : <div className="share-qr-content"><div className="qr-paper"><QRCodeSVG id="project-share-qr" value={link} size={190} level="H" includeMargin bgColor="#ffffff" fgColor="#15121b" /></div><h3>{t('Scan to open the project')}</h3><p>{t('The QR encodes this project’s share URL, not its files.')}</p><button className="button button-secondary" onClick={downloadQr}><DownloadIcon /> {t('Download QR as SVG')}</button><button className="qr-copy-link" onClick={copy}><Copy size={13} /> {t('Copy link instead')}</button></div>}
    </>}
    <div className="share-modal-footer"><span><ShieldCheck size={14} /> {t('Vault files can never be shared.')}</span><button type="button" className="button button-quiet" onClick={onClose}>{t('Done')}</button></div>
  </Modal>;
}

export function FilePreviewDialog({ file, blob, onClose, onDownload }: { file: import('../types').ProjectFile; blob: Blob; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textError, setTextError] = useState(false);
  const { t } = useLanguage();
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
  return <Modal onClose={onClose} className="file-preview-modal" labelledBy="file-preview-title"><header className="file-preview-header"><div className="file-preview-heading"><FileGlyph file={file} size={18} /><div><div className="modal-kicker">{t('FILE PREVIEW')}</div><h2 id="file-preview-title">{file.name}</h2><span>{formatBytes(file.size)} <i>·</i> {file.type || t('File')}</span></div></div><div className="file-preview-header-actions"><button type="button" className="button button-secondary button-sm" onClick={onDownload}><DownloadIcon /> {t('Download')}</button></div></header><div className="file-preview-stage">{url && isImage && <img src={url} alt={t('Preview of {name}', { name: file.name })} />}{url && isVideo && <video src={url} controls playsInline aria-label={t('Video preview of {name}', { name: file.name })} />}{url && isPdf && <iframe src={url} title={t('PDF preview of {name}', { name: file.name })} />}{isText && (textError ? <div className="preview-fallback"><AlertTriangle size={18} /> {t('Could not read this preview. Download the file to open it.')}</div> : <pre className="file-text-preview">{textContent || t('Loading preview…')}</pre>)}{!isImage && !isVideo && !isPdf && !isText && <div className="preview-fallback"><Info size={18} /> {t('Preview isn’t available for this format. Download the file to open it.')}</div>}</div><footer className="file-preview-footer"><ShieldCheck size={14} /> {t('Fetched from your account; this temporary preview stays in browser memory.')}</footer></Modal>;
}

export function ProjectSettingsModal({ project, onClose, onSave, onToast }:  { project: Project; onClose: () => void; onSave: (next: Project, password?: string) => Promise<Project | void> | Project | void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [name, setName] = useState(project.name);
  const [privacy, setPrivacy] = useState<PrivacyMode>(project.privacy);
  const [newPassword, setNewPassword] = useState('');
  const [expiry, setExpiry] = useState(() => inferPreset(project.expiresAt));
  const [customDate, setCustomDate] = useState(() => dateTimeInput(project.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (privacy === 'password' && project.privacy !== 'password' && !newPassword) { setError('Set a password to protect this project.'); return; }
    if (privacy === 'password' && newPassword && !/^[A-Za-z0-9]{8,64}$/.test(newPassword)) { setError('Use at least 8 letters or numbers.'); return; }
    if (expiry === 'custom' && (!Number.isFinite(new Date(customDate).getTime()) || new Date(customDate).getTime() <= Date.now())) { setError('Choose a future expiration date.'); return; }
    setBusy(true);
    try {
      const updated: Project = {
        ...project, name: name.trim(), privacy,
        token: privacy === 'private' ? null : project.token,
        expiresAt: getExpiration(expiry, customDate), updatedAt: Date.now(),
      };
      await onSave(updated, privacy === 'password' && newPassword ? newPassword : undefined);
      onToast(t('Cloud settings saved'), t('The server applied the project access settings.'), 'success');
      onClose();
    } catch { setError('Settings could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal onClose={onClose} className="settings-modal" labelledBy="project-settings-title"><div className="settings-modal-header"><div className="modal-kicker"><span className="modal-kicker-dot" /> {t('PROJECT SETTINGS')}</div><h2 id="project-settings-title">{t('Sharing settings')}</h2><p>{t('Change the project name, access type, or expiration.')}</p></div><form onSubmit={save}>
    <label className="field-label" htmlFor="settings-project-name">{t('Project name')}</label><input className="text-field" id="settings-project-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
    <div className="field-label settings-access-label">{t('Who can access')}</div><div className="settings-privacy-options"><button type="button" className={privacy === 'open' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('open')}><Link2 size={16} /><span><strong>{t('Link access')}</strong><small>{t('Anyone with the link')}</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'password' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('password')}><LockKeyhole size={16} /><span><strong>{t('Password protected')}</strong><small>{t('Require a password')}</small></span><span className="choice-radio" /></button><button type="button" className={privacy === 'private' ? 'settings-privacy-selected' : ''} onClick={() => setPrivacy('private')}><ShieldCheck size={16} /><span><strong>{t('Private')}</strong><small>{t('Owner only')}</small></span><span className="choice-radio" /></button></div>
    {privacy === 'password' && <div className="password-field-block"><label className="field-label" htmlFor="settings-new-password">{project.privacy === 'password' ? t('Replace password (optional)') : t('Set a share password')}</label><div className="password-input-wrap"><KeyRound size={15} /><input id="settings-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 64))} placeholder={project.privacy === 'password' ? t('Leave blank to keep the current one') : t('At least 8 letters or numbers')} maxLength={64} /></div><small className="field-hint">{t('The server verifies this password and does not return it as readable text.')}</small></div>}
    <div className="field-label settings-access-label">{t('Expiration')}</div><div className="select-field-wrap"><Clock3 size={15} /><select value={expiry} onChange={(event) => setExpiry(event.target.value)} aria-label={t('Expiration setting')}>{expiryPresets.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select><ChevronDown size={14} /></div>{expiry === 'custom' && <input className="text-field custom-date-input" type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label={t('Custom expiration date')} />}
    <div className="settings-modal-notice"><Info size={14} /><span>{t('Changes are saved by the server and apply to this account-owned project link.')}</span></div>{error && <div className="modal-inline-error"><AlertTriangle size={14} /> {t(error)}</div>}
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>{t('Cancel')}</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? t('Saving…') : t('Save settings')} <ArrowRight size={15} /></button></div>
  </form></Modal>;
}

export function ConfirmDialog({ title, body, confirmLabel, destructive = false, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose} className="confirm-modal" labelledBy="confirm-dialog-title"><div className={`confirm-icon${destructive ? ' confirm-icon-danger' : ''}`}>{destructive ? <AlertTriangle size={21} /> : <Info size={21} />}</div><h2 id="confirm-dialog-title">{t(title)}</h2><p>{t(body)}</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>{t('Cancel')}</button><button type="button" className={`button ${destructive ? 'button-danger' : 'button-primary'}`} onClick={() => { void confirm(); }} disabled={busy}>{busy ? t('Working…') : t(confirmLabel)}</button></div></Modal>;
}

export function GoogleInfoModal({ onClose, clientConfigured }: { onClose: () => void; clientConfigured: boolean }) {
  const { t } = useLanguage();
  return <Modal onClose={onClose} className="integration-modal" labelledBy="google-info-title"><div className="integration-modal-icon"><KeyRound size={21} /></div><div className="modal-kicker">{t('AUTHENTICATION SETUP')}</div><h2 id="google-info-title">{t('Google account sign-in')}</h2><p>{t('Sign in with Google to use the workspace. The API verifies the account before loading cloud projects and Vault data.')}</p><div className="integration-roadmap"><div><span>01</span><strong>{t('Add VITE_GOOGLE_CLIENT_ID and authorize this website origin')}</strong></div><div><span>02</span><strong>{t('Set the matching GOOGLE_CLIENT_ID on the server')}</strong></div><div><span>03</span><strong>{t('Configure Neon and apply the database migration')}</strong></div></div><div className="integration-modal-note"><Info size={14} /> {t('Frontend client ID: {state}. After server-verified sign-in, projects and Vault files use their separate cloud storage paths.', { state: clientConfigured ? t('present in this build') : t('not present in this build') })}</div><div className="modal-actions"><button type="button" className="button button-primary" onClick={onClose}>{t('Got it')} <Check size={15} /></button></div></Modal>;
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
