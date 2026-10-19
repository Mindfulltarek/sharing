import { useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, Check, FilePlus2, Fingerprint, KeyRound, LockKeyhole, Plus, ShieldAlert, ShieldCheck, Unlock, UploadCloud, X } from 'lucide-react';
import type { VaultFile } from '../types';
import { formatBytes, formatDate } from '../services';
import { FileGlyph } from './common';
import { useLanguage } from '../i18n';

export default function VaultView({ configured, files, unlocked, onSetup, onUnlock, onLock, onAdd, onDownload, onDelete, onToast }: {
  configured: boolean;
  files: VaultFile[];
  unlocked: boolean;
  onSetup: (passphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
  onLock: () => void;
  onAdd: (files: File[]) => Promise<void>;
  onDownload: (file: VaultFile) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const addFiles = async (incoming: FileList | null) => {
    if (!incoming?.length || busy) return;
    setBusy(true); setError('');
    try { await onAdd(Array.from(incoming)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Could not upload these files. Try again.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const canSetup = passphrase.length >= 8 && passphrase === confirm;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!configured) {
      if (passphrase.length < 8) { setError('Use at least 8 characters for your Vault passphrase.'); return; }
      if (passphrase !== confirm) { setError('Those passphrases do not match.'); return; }
    } else if (!passphrase) { setError('Enter your Vault passphrase to continue.'); return; }
    setBusy(true);
    try {
      if (!configured) await onSetup(passphrase);
      else await onUnlock(passphrase);
      setPassphrase(''); setConfirm('');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not open the Vault. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="workspace-content vault-workspace">
      {!unlocked ? (
        <>
          <div className="workspace-page-heading vault-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> {t('PRIVATE BY DESIGN')}</div><h1>{t('Your Vault')}</h1><p>{t('A cloud-backed area, separate from projects and share links.')}</p></div><span className="vault-lock-status"><span className="status-pulse status-locked" /> {t('LOCKED')}</span></div>
          <div className="vault-locked-layout">
            <div className="vault-locked-card">
              <div className="vault-locked-art"><div className="vault-ambient" /><div className="vault-rings"><span /><span /><span /><div className="vault-lock-core"><LockKeyhole size={34} strokeWidth={1.6} /></div></div><div className="vault-art-chip"><span /> {t('CLOUD STORAGE')}</div></div>
              <div className="vault-locked-content">
                <div className="vault-private-pill"><ShieldCheck size={14} /> {t('SEPARATE FROM PROJECTS')}</div>
                <h2>{configured ? t('Your Vault is locked.') : t('Set up your cloud Vault.')}</h2>
                <p>{configured ? t('Enter your separate Vault passphrase to load its cloud-stored files.') : t('Choose a passphrase to create a cloud-backed Vault, separate from project links.')}</p>
                <form className="vault-unlock-form" onSubmit={(event) => void submit(event)}>
                  <label className="field-label" htmlFor="vault-passphrase">{configured ? t('Vault passphrase') : t('Create a Vault passphrase')}</label>
                  <div className="input-with-icon"><KeyRound size={16} /><input id="vault-passphrase" type="password" autoComplete={configured ? 'current-password' : 'new-password'} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={configured ? t('Enter your passphrase') : t('At least 8 characters')} minLength={configured ? undefined : 8} /></div>
                  {!configured && <><label className="field-label confirm-label" htmlFor="vault-confirm">{t('Confirm passphrase')}</label><div className="input-with-icon"><KeyRound size={16} /><input id="vault-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={t('Type it again')} /></div></>}
                  {error && <div className="inline-error" role="alert"><AlertCircle size={14} /> {t(error)}</div>}
                  <button className="button button-primary vault-submit" type="submit" disabled={busy || (configured ? !passphrase : !canSetup)}>{busy ? t('Preparing…') : configured ? <><Unlock size={16} /> {t('Unlock Vault')}</> : <><LockKeyhole size={16} /> {t('Set up cloud Vault')}</>}</button>
                </form>
                <div className="vault-access-caution"><ShieldAlert size={16} /><span><strong>{t('Separate access, clear limits.')}</strong> {t('The passphrase gates Vault API access. It is separate from project share passwords; this app does not claim end-to-end encryption.')}</span></div>
              </div>
            </div>
            <div className="vault-guardrail-list"><div><span className="guardrail-icon"><X size={14} /></span><span><strong>{t('No share links')}</strong><small>{t('Vault items can’t be turned into links or QR codes.')}</small></span></div><div><span className="guardrail-icon"><X size={14} /></span><span><strong>{t('Not in project search')}</strong><small>{t('Vault names stay separate from the project workspace.')}</small></span></div><div><span className="guardrail-icon"><Fingerprint size={15} /></span><span><strong>{t('Separate unlock')}</strong><small>{t('A Vault passphrase is distinct from share passwords.')}</small></span></div></div>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-page-heading vault-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> {t('PRIVATE BY DESIGN')}</div><h1>{t('Your Vault')}</h1><p>{t('Files here are not connected to Projects, public links, or QR codes.')}</p></div><div className="vault-unlocked-actions"><span className="vault-lock-status vault-open-status"><span className="status-pulse" /> {t('UNLOCKED')}</span><button type="button" className="button button-secondary" onClick={onLock}><LockKeyhole size={15} /> {t('Lock now')}</button></div></div>
          <div className="vault-unlocked-banner"><div className="vault-banner-shield"><ShieldCheck size={20} /></div><div><strong>{t('Your private cloud space')}</strong><span>{t('Files are stored in your connected cloud storage and remain separate from project files and shares.')}</span></div><span className="vault-banner-tag">{t('AUTO-LOCK · 5 MIN')}</span></div>
          <div className="vault-files-heading"><div><h2>{t('Stored items')} <span className="subtle-count">{files.length}</span></h2><p>{t('Private Vault entries are never indexed with project files.')}</p></div><button type="button" className="button button-primary" onClick={() => inputRef.current?.click()} disabled={busy}><Plus size={16} /> {busy ? t('Uploading…') : t('Add files')}</button></div>
          <input ref={inputRef} className="visually-hidden-input" type="file" multiple onChange={(event) => void addFiles(event.target.files)} aria-label={t('Add files to Vault')} />
          {error && <div className="inline-error" role="alert"><AlertCircle size={14} /> {t(error)}</div>}
          {files.length ? <div className="vault-file-list">{files.map((file) => <VaultItem key={file.id} file={file} onDownload={() => onDownload(file)} onDelete={() => onDelete(file.id)} onToast={onToast} />)}</div> : <div className="vault-empty"><div className="vault-empty-icon"><FilePlus2 size={22} /></div><h3>{t('Your Vault is empty')}</h3><p>{t('Choose files to store in this separate cloud area.')}</p><button type="button" className="button button-secondary" onClick={() => inputRef.current?.click()}><UploadCloud size={16} /> {t('Choose files')}</button></div>}
          <div className="vault-storage-warning"><ShieldAlert size={16} /><div><strong>{t('Separate access, clear limits.')}</strong><span>{t('The passphrase gates Vault access. The Vault is cloud-stored but is not presented as end-to-end encrypted.')}</span></div><button type="button" onClick={onLock}>{t('Lock Vault')} <LockKeyhole size={13} /></button></div>
        </>
      )}
    </div>
  );
}

function VaultItem({ file, onDownload, onDelete, onToast }: { file: VaultFile; onDownload: () => Promise<void>; onDelete: () => Promise<void>; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();
  const asProjectFile = { id: file.id, name: file.name, size: file.size, type: file.type };
  const handle = async (action: () => Promise<void>, successTitle: string, successBody: string) => {
    if (busy) return;
    setBusy(true);
    try { await action(); onToast(t(successTitle), t(successBody), 'success'); }
    catch (error) { onToast(t('Vault action failed'), t(error instanceof Error ? error.message : 'The request could not be completed.'), 'error'); }
    finally { setBusy(false); }
  };
  return <div className="vault-file-row"><FileGlyph file={asProjectFile} size={18} /><div className="vault-file-name"><strong>{file.name}</strong><span>{t('Added')} {formatDate(file.addedAt)} <i>·</i> {formatBytes(file.size)}</span></div><span className="vault-file-private"><LockKeyhole size={13} /> {t('Private')}</span><button type="button" className="icon-button" disabled={busy} onClick={() => void handle(onDownload, 'Download started', file.name)} aria-label={`${t('Download')} ${file.name}`} title={t('Download')}><ArrowDownToLine size={16} /></button><button type="button" className="icon-button vault-remove-button" disabled={busy} onClick={() => void handle(onDelete, 'Removed from Vault', t('The cloud Vault entry was removed.'))} aria-label={`${t('Remove')} ${file.name} ${t('from Vault')}`} title={t('Remove from Vault')}>{busy ? <Check size={16} /> : <X size={16} />}</button></div>;
}
