import { useEffect, useState } from 'react';
import type { DragEvent as ReactDragEvent, ReactNode } from 'react';
import { AlertCircle, Check, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, FolderLock, Info, LockKeyhole, Unlock, X } from 'lucide-react';
import type { Project, ProjectFile, ToastMessage } from '../types';
import { formatBytes, formatDate, isExpired, humanFileKind } from '../services';
import { useLanguage } from '../i18n';

export function Logo({ small = false }: { small?: boolean }) {
  const { t } = useLanguage();
  return (
    <span className={`brand-lockup${small ? ' brand-lockup-small' : ''}`} aria-label={t('Sharing')}>
      <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" role="img"><path d="M3.1 11.1 20.9 3.4 14.2 20.6l-2.8-7.2-8.3-2.3Z" /><path d="m11.4 13.4 8.1-9.2" /></svg></span>
      <span className="brand-word">sharing<span className="brand-period">.</span></span>
    </span>
  );
}

export function Modal({
  children, onClose, className = '', labelledBy, closeLabel = 'Close dialog', onFilesDrop,
}: { children: ReactNode; onClose: () => void; className?: string; labelledBy?: string; closeLabel?: string; onFilesDrop?: (files: File[]) => void }) {
  const { t } = useLanguage();
  const [draggingFiles, setDraggingFiles] = useState(false);
  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', dismissOnEscape);
    return () => { document.body.style.overflow = priorOverflow; window.removeEventListener('keydown', dismissOnEscape); };
  }, [onClose]);
  const hasFiles = (event: ReactDragEvent) => Array.from(event.dataTransfer.types || []).includes('Files');
  return (
    <div
      className={`modal-backdrop${draggingFiles ? ' modal-backdrop-file-dragging' : ''}`}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      onDragEnter={(event) => { if (!onFilesDrop || !hasFiles(event)) return; event.preventDefault(); setDraggingFiles(true); }}
      onDragOver={(event) => { if (!onFilesDrop || !hasFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDraggingFiles(true); }}
      onDragLeave={(event) => { if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return; setDraggingFiles(false); }}
      onDrop={(event) => { if (!onFilesDrop || !hasFiles(event)) return; event.preventDefault(); event.stopPropagation(); setDraggingFiles(false); const files = Array.from(event.dataTransfer.files || []); if (files.length) onFilesDrop(files); }}
    >
      {draggingFiles && <div className="modal-global-drop-hint" role="status"><span>{t('Drop files anywhere in this window to add them')}</span></div>}
      <section className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label={t(closeLabel)}><X size={18} /></button>
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
  const { t } = useLanguage();
  if (expired) return <span className={`privacy-badge badge-expired${compact ? ' badge-compact' : ''}`}><AlertCircle size={13} /> {t('Expired')}</span>;
  if (project.privacy === 'password') return <span className={`privacy-badge badge-protected${compact ? ' badge-compact' : ''}`}><LockKeyhole size={13} /> {t('Protected')}</span>;
  if (project.privacy === 'private') return <span className={`privacy-badge badge-private${compact ? ' badge-compact' : ''}`}><FolderLock size={13} /> {t('Private')}</span>;
  return <span className={`privacy-badge badge-open${compact ? ' badge-compact' : ''}`}><Unlock size={13} /> {t('Link access')}</span>;
}

export function ExpirationLabel({ project }: { project: Project }) {
  const { t } = useLanguage();
  if (isExpired(project)) return <span className="expiration-label expiration-overdue">{t('Expired — cloud link disabled')}</span>;
  if (!project.expiresAt) return <span className="expiration-label">{t('No expiration')}</span>;
  const remaining = project.expiresAt - Date.now();
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  return <span className={`expiration-label${days <= 1 ? ' expiration-soon' : ''}`}>{t('Expires')} {days <= 1 ? t('soon') : t('in {count} days', { count: days })} · {formatDate(project.expiresAt)}</span>;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  const { t } = useLanguage();
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? Check : toast.kind === 'error' ? AlertCircle : Info;
        return (
          <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon"><Icon size={16} /></span>
            <div className="toast-copy"><strong>{t(toast.title)}</strong>{toast.body && <span>{t(toast.body)}</span>}</div>
            <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)} aria-label={t('Dismiss notification')}><X size={15} /></button>
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
  const { t } = useLanguage();
  if (!files.length) return <div className="empty-files">{t('No files in this project yet.')}</div>;
  return (
    <div className="file-table" role="table" aria-label={t('Project files')}>
      <div className="file-table-head" role="row">
        <span role="columnheader">{t('Name')}</span><span role="columnheader">{t('Size')}</span><span role="columnheader" className="file-date-col">{t('Added')}</span><span role="columnheader" className="file-action-col"><span className="sr-only">{t('Actions')}</span></span>
      </div>
      {files.map((file) => (
        <div className="file-table-row" role="row" key={file.id}>
          <div className="file-name-cell" role="cell"><FileGlyph file={file} /><div className="file-title-wrap">{onPreview && canPreviewFile(file) ? <button type="button" className="file-title file-preview-trigger" onClick={() => onPreview(file)}>{file.name}</button> : <span className="file-title">{file.name}</span>}<span className="file-subtitle">{file.available === false ? t('Unavailable in cloud storage') : file.type || t('File')}</span></div></div>
          <span className="file-size-cell" role="cell">{formatBytes(file.size)}</span>
          <span className="file-date-cell" role="cell">{file.modifiedAt ? formatDate(file.modifiedAt) : '—'}</span>
          <span className="file-row-action" role="cell">{onPreview && canPreviewFile(file) && <button className="icon-button file-preview-action" type="button" onClick={() => onPreview(file)} disabled={disabled || file.available === false} aria-label={t('Preview {name}', { name: file.name })} title={t('Preview {name}', { name: file.name })}><Eye size={16} /></button>}<button className="icon-button" type="button" onClick={() => onDownload(file)} disabled={disabled || file.available === false} aria-label={t('Download {name}', { name: file.name })} title={t('Download {name}', { name: file.name })}><DownloadIcon /></button></span>
        </div>
      ))}
    </div>
  );
}

function DownloadIcon() {
  // Kept local so file list consumers do not need to import a second icon set.
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>;
}
