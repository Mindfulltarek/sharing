import { useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowRight, Check, FilePlus2, Fingerprint, KeyRound, LockKeyhole, Plus, ShieldAlert, ShieldCheck, Unlock, UploadCloud, X } from 'lucide-react';
import type { VaultFile, VaultMetadata } from '../types';
import { formatBytes, formatDate } from '../services';
import { FileGlyph } from './common';

export default function VaultView({ vaultMeta, unlocked, onSetup, onUnlock, onLock, onAdd, onDelete, onToast }: {
  vaultMeta: VaultMetadata; unlocked: boolean; onSetup: (passphrase: string) => void; onUnlock: (passphrase: string) => void;
  onLock: () => void; onAdd: (files: File[]) => void; onDelete: (id: string) => void;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onAdd(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  };
  const canSetup = passphrase.length >= 8 && passphrase === confirm;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!vaultMeta.passwordHash) {
      if (passphrase.length < 8) { setError('Use at least 8 characters for your Vault passphrase.'); return; }
      if (passphrase !== confirm) { setError('Those passphrases do not match.'); return; }
      onSetup(passphrase);
      setPassphrase(''); setConfirm('');
    } else {
      if (!passphrase) { setError('Enter your Vault passphrase to continue.'); return; }
      onUnlock(passphrase);
      setPassphrase('');
    }
  };

  return (
    <div className="workspace-content vault-workspace">
      {!unlocked ? (
        <>
          <div className="workspace-page-heading vault-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> PRIVATE BY DESIGN</div><h1>Your Vault</h1><p>A separate, private area — never part of a public share.</p></div><span className="vault-lock-status"><span className="status-pulse status-locked" /> LOCKED</span></div>
          <div className="vault-locked-layout">
            <div className="vault-locked-card">
              <div className="vault-locked-art"><div className="vault-ambient" /><div className="vault-rings"><span /><span /><span /><div className="vault-lock-core"><LockKeyhole size={34} strokeWidth={1.6} /></div></div><div className="vault-art-chip"><span /> LOCAL ONLY</div></div>
              <div className="vault-locked-content">
                <div className="vault-private-pill"><ShieldCheck size={14} /> SEPARATE FROM PROJECTS</div>
                <h2>{vaultMeta.passwordHash ? 'Your Vault is locked.' : 'A little space, just for you.'}</h2>
                <p>{vaultMeta.passwordHash ? 'Enter your separate Vault passphrase to see its contents.' : 'Choose a passphrase to set up your local demo Vault. It is separate from any project share password.'}</p>
                <form className="vault-unlock-form" onSubmit={submit}>
                  <label className="field-label" htmlFor="vault-passphrase">{vaultMeta.passwordHash ? 'Vault passphrase' : 'Create a Vault passphrase'}</label>
                  <div className="input-with-icon"><KeyRound size={16} /><input id="vault-passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={vaultMeta.passwordHash ? 'Enter your passphrase' : 'At least 8 characters'} minLength={vaultMeta.passwordHash ? undefined : 8} /></div>
                  {!vaultMeta.passwordHash && <><label className="field-label confirm-label" htmlFor="vault-confirm">Confirm passphrase</label><div className="input-with-icon"><KeyRound size={16} /><input id="vault-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Type it again" /></div></>}
                  {error && <div className="inline-error"><AlertCircle size={14} /> {error}</div>}
                  <button className="button button-primary vault-submit" type="submit" disabled={vaultMeta.passwordHash ? !passphrase : !canSetup}>{vaultMeta.passwordHash ? <><Unlock size={16} /> Unlock Vault</> : <><LockKeyhole size={16} /> Set up local Vault</>}</button>
                </form>
                <div className="vault-local-caution"><ShieldAlert size={15} /><span><strong>Demo, not secure storage.</strong> This prototype stores Vault filenames in this browser and does not encrypt file contents. Nothing is uploaded, but don’t add sensitive files.</span></div>
              </div>
            </div>
            <div className="vault-guardrail-list"><div><span className="guardrail-icon"><X size={14} /></span><span><strong>No share links</strong><small>Vault items can’t be turned into links or QR codes.</small></span></div><div><span className="guardrail-icon"><X size={14} /></span><span><strong>Not in project search</strong><small>Vault names stay separate from the project workspace.</small></span></div><div><span className="guardrail-icon"><Fingerprint size={15} /></span><span><strong>Separate unlock</strong><small>A Vault passphrase is distinct from share passwords.</small></span></div></div>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-page-heading vault-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> PRIVATE BY DESIGN</div><h1>Your Vault</h1><p>Files here are not connected to Projects, public links, or QR codes.</p></div><div className="vault-unlocked-actions"><span className="vault-lock-status vault-open-status"><span className="status-pulse" /> UNLOCKED</span><button type="button" className="button button-secondary" onClick={onLock}><LockKeyhole size={15} /> Lock now</button></div></div>
          <div className="vault-unlocked-banner"><div className="vault-banner-shield"><ShieldCheck size={20} /></div><div><strong>Your private space</strong><span>This is a local demo Vault. Items and filenames stay in browser storage; selected file contents are only available in this session.</span></div><span className="vault-banner-tag">AUTO-LOCK · 5 MIN</span></div>
          <div className="vault-files-heading"><div><h2>Stored items <span className="subtle-count">{vaultMeta.files.length}</span></h2><p>Private Vault entries are never indexed with project files.</p></div><button type="button" className="button button-primary" onClick={() => inputRef.current?.click()}><Plus size={16} /> Add files</button></div>
          <input ref={inputRef} className="visually-hidden-input" type="file" multiple onChange={(event) => addFiles(event.target.files)} aria-label="Add files to Vault" />
          {vaultMeta.files.length ? <div className="vault-file-list">{vaultMeta.files.map((file) => <VaultItem key={file.id} file={file} onDelete={() => onDelete(file.id)} onToast={onToast} />)}</div> : <div className="vault-empty"><div className="vault-empty-icon"><FilePlus2 size={22} /></div><h3>Your Vault is empty</h3><p>Add a few local demo files to see how this private area is organized.</p><button type="button" className="button button-secondary" onClick={() => inputRef.current?.click()}><UploadCloud size={16} /> Choose files</button></div>}
          <div className="vault-demo-warning"><ShieldAlert size={16} /><div><strong>Use sample files only in this demo.</strong><span>Browser data can be cleared, file contents are not persisted, and the passphrase only locks this prototype UI. This is not production-grade encryption.</span></div><button type="button" onClick={onLock}>Lock Vault <ArrowRight size={13} /></button></div>
        </>
      )}
    </div>
  );
}

function VaultItem({ file, onDelete, onToast }: { file: VaultFile; onDelete: () => void; onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void }) {
  const asProjectFile = { id: file.id, name: file.name, size: file.size, type: file.type };
  return <div className="vault-file-row"><FileGlyph file={asProjectFile} size={18} /><div className="vault-file-name"><strong>{file.name}</strong><span>Added {formatDate(file.addedAt)} <i>·</i> {formatBytes(file.size)}</span></div><span className="vault-file-private"><LockKeyhole size={13} /> Private</span><button type="button" className="icon-button vault-remove-button" onClick={() => { onDelete(); onToast('Removed from Vault', 'The local demo metadata was deleted.', 'success'); }} aria-label={`Remove ${file.name} from Vault`} title="Remove from Vault"><X size={16} /></button></div>;
}
