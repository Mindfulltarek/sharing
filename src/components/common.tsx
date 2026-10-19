import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Check, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, FolderLock, Info, LockKeyhole, Unlock, X } from 'lucide-react';
import type { Project, ProjectFile, ToastMessage } from '../types';
import { formatBytes, formatDate, isExpired, humanFileKind } from '../services';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-lockup${small ? ' brand-lockup-small' : ''}`} aria-label="Sharing">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span className="brand-word">sharing<span className="brand-period">.</span></span>
    </span>
  );
}

export function Modal({
  children, onClose, className = '', labelledBy, closeLabel = 'Close dialog',
}: { children: ReactNode; onClose: () => void; className?: string; labelledBy?: string; closeLabel?: string }) {
  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', dismissOnEscape);
    return () => { document.body.style.overflow = priorOverflow; window.removeEventListener('keydown', dismissOnEscape); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label={closeLabel}><X size={18} /></button>
        {children}
      </section>
    </div>
  );
}

export function FileGlyph({ file, size = 18 }: { file: ProjectFile; size?: number }) {
  const kind = humanFileKind(file);
  const Icon = kind === 'image' ? FileImage : kind === 'sheet' ? FileSpreadsheet : kind === 'archive' ? FileArchive : FileText;
  return <span className={`file-glyph file-glyph-${kind}`}><Icon size={size} strokeWidth={1.8} aria-hidden="true" /></span>;
}

export function PrivacyBadge({ project, compact = false }: { project: Project; compact?: boolean }) {
  const expired = isExpired(project);
  if (expired) return <span className={`privacy-badge badge-expired${compact ? ' badge-compact' : ''}`}><AlertCircle size={13} /> Expired</span>;
  if (project.privacy === 'password') return <span className={`privacy-badge badge-protected${compact ? ' badge-compact' : ''}`}><LockKeyhole size={13} /> Protected</span>;
  if (project.privacy === 'private') return <span className={`privacy-badge badge-private${compact ? ' badge-compact' : ''}`}><FolderLock size={13} /> Private</span>;
  return <span className={`privacy-badge badge-open${compact ? ' badge-compact' : ''}`}><Unlock size={13} /> Link access</span>;
}

export function ExpirationLabel({ project }: { project: Project }) {
  if (isExpired(project)) return <span className="expiration-label expiration-overdue">Expired — cloud copy removed (demo)</span>;
  if (!project.expiresAt) return <span className="expiration-label">No expiration</span>;
  const remaining = project.expiresAt - Date.now();
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  return <span className={`expiration-label${days <= 1 ? ' expiration-soon' : ''}`}>Expires {days <= 1 ? 'soon' : `in ${days} days`} · {formatDate(project.expiresAt)}</span>;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? Check : toast.kind === 'error' ? AlertCircle : Info;
        return (
          <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon"><Icon size={16} /></span>
            <div className="toast-copy"><strong>{toast.title}</strong>{toast.body && <span>{toast.body}</span>}</div>
            <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification"><X size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Clipboard access was not available');
}

export function localDateTimeValue(timestamp: number) {
  const local = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function totalSize(files: ProjectFile[]) {
  return files.reduce((sum, file) => sum + (file.size || 0), 0);
}

export function canPreviewFile(file: ProjectFile) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const previewable = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'ogv', 'pdf', 'txt', 'md', 'csv'];
  if (!extension || !previewable.includes(extension)) return false;
  const textFile = ['txt', 'md', 'csv'].includes(extension);
  return file.size <= (textFile ? 2 : 24) * 1024 * 1024;
}

export function ProjectFileList({
  files, onDownload, onPreview, disabled = false,
}: { files: ProjectFile[]; onDownload: (file: ProjectFile) => void; onPreview?: (file: ProjectFile) => void; disabled?: boolean }) {
  if (!files.length) return <div className="empty-files">No files in this project yet.</div>;
  return (
    <div className="file-table" role="table" aria-label="Project files">
      <div className="file-table-head" role="row">
        <span role="columnheader">Name</span><span role="columnheader">Size</span><span role="columnheader" className="file-date-col">Added</span><span role="columnheader" className="file-action-col"><span className="sr-only">Actions</span></span>
      </div>
      {files.map((file) => (
        <div className="file-table-row" role="row" key={file.id}>
          <div className="file-name-cell" role="cell"><FileGlyph file={file} /><div className="file-title-wrap">{onPreview && canPreviewFile(file) ? <button type="button" className="file-title file-preview-trigger" onClick={() => onPreview(file)}>{file.name}</button> : <span className="file-title">{file.name}</span>}<span className="file-subtitle">{file.type || 'File'}</span></div></div>
          <span className="file-size-cell" role="cell">{formatBytes(file.size)}</span>
          <span className="file-date-cell" role="cell">{file.modifiedAt ? formatDate(file.modifiedAt) : '—'}</span>
          <span className="file-row-action" role="cell">{onPreview && canPreviewFile(file) && <button className="icon-button file-preview-action" type="button" onClick={() => onPreview(file)} disabled={disabled} aria-label={`Preview ${file.name}`} title={`Preview ${file.name}`}><Eye size={16} /></button>}<button className="icon-button" type="button" onClick={() => onDownload(file)} disabled={disabled} aria-label={`Download ${file.name}`} title={`Download ${file.name}`}><DownloadIcon /></button></span>
        </div>
      ))}
    </div>
  );
}

function DownloadIcon() {
  // Kept local so file list consumers do not need to import a second icon set.
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>;
}
