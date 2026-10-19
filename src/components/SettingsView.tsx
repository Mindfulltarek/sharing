import { useState } from 'react';
import { Database, ExternalLink, HardDrive, KeyRound, Link2, LockKeyhole, LogIn, RotateCcw, ShieldCheck, Trash2, UserRound, Cloud, Info, Eye, EyeOff, ArrowRight } from 'lucide-react';
import type { Project, VaultMetadata } from '../types';
import { formatBytes } from '../services';

export default function SettingsView({ projects, shared, vaultMeta, storageBytes, onClearDemo, onGoogleInfo, onOpenCloud, onOpenMarketing, onOpenVault, onChangeVaultPassphrase, onToast }: {
  projects: Project[]; shared: Project[]; vaultMeta: VaultMetadata; storageBytes: number;
  onClearDemo: () => void; onGoogleInfo: () => void; onOpenCloud: () => void; onOpenMarketing: () => void; onOpenVault: () => void;
  onChangeVaultPassphrase: (current: string, next: string) => Promise<boolean>;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [vaultPasswordError, setVaultPasswordError] = useState('');
  const [vaultPasswordBusy, setVaultPasswordBusy] = useState(false);

  const changeVaultPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setVaultPasswordError('');
    if (!vaultMeta.passwordHash) { setVaultPasswordError('Set up the Vault first.'); return; }
    if (newPassphrase.length < 8) { setVaultPasswordError('Use at least 8 characters for the new passphrase.'); return; }
    if (newPassphrase !== confirmPassphrase) { setVaultPasswordError('The new passphrases do not match.'); return; }
    setVaultPasswordBusy(true);
    try {
      const saved = await onChangeVaultPassphrase(currentPassphrase, newPassphrase);
      if (!saved) { setVaultPasswordError('The current passphrase is incorrect.'); return; }
      setCurrentPassphrase(''); setNewPassphrase(''); setConfirmPassphrase('');
      onToast('Vault passphrase changed', 'The Vault is locked until you unlock it with the new passphrase.', 'success');
    } finally { setVaultPasswordBusy(false); }
  };

  return (
    <div className="workspace-content settings-workspace">
      <div className="workspace-page-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> YOUR PREFERENCES</div><h1>Settings</h1><p>Manage this browser-only workspace and your separate Vault.</p></div><span className="settings-demo-pill"><span className="status-pulse" /> LOCAL WORKSPACE</span></div>
      <div className="settings-layout">
        <div className="settings-main-column">
          <section className="settings-panel profile-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon"><UserRound size={17} /></div><div><h2>Profile</h2><p>Your current demo identity.</p></div></div><div className="profile-settings-card"><span className="profile-settings-avatar">L</span><div><strong>This browser</strong><span>Local workspace</span></div><span className="local-badge"><span className="status-pulse" /> LOCAL</span></div></section>
          <section className="settings-panel auth-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon auth-icon"><LogIn size={17} /></div><div><h2>Account connection</h2><p>Google sign-in opens a separate cloud workspace.</p></div></div><div className="integration-card"><div className="google-mark" aria-hidden="true">G</div><div className="integration-copy"><strong>Google cloud workspace <span>Sign-in required</span></strong><p>Upload projects to your account for cross-device access. Existing local projects are not synced automatically.</p></div><button className="button button-secondary button-sm" type="button" onClick={onOpenCloud}>Open cloud <ArrowRight size={13} /></button></div><div className="integration-note"><Info size={14} /> Vault and browser-local projects remain separate from cloud projects.</div></section>
          <section className="settings-panel storage-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon storage-icon"><Database size={17} /></div><div><h2>Local demo data</h2><p>Stored in this browser, not a cloud account.</p></div></div><div className="storage-summary"><div className="storage-summary-icon"><HardDrive size={21} /></div><div className="storage-summary-copy"><strong>{formatBytes(storageBytes)}</strong><span>Estimated metadata for {projects.length} projects, {shared.length} imports, and {vaultMeta.files.length} Vault entries</span></div><span className="metadata-only-pill">METADATA ONLY</span></div><div className="storage-footnote">Selected file contents are kept in memory for this session only. This estimate is not a cloud storage quota and does not include browser storage used by unrelated sites.</div></section>
          <section className="settings-panel vault-password-settings"><div className="settings-panel-heading"><div className="settings-section-icon vault-settings-icon"><LockKeyhole size={17} /></div><div><h2>Vault passphrase</h2><p>Change the password that unlocks your separate Vault.</p></div></div>{vaultMeta.passwordHash ? <form className="vault-password-form" onSubmit={changeVaultPassword}><label className="field-label" htmlFor="current-vault-pass">Current Vault passphrase</label><input className="text-field" id="current-vault-pass" type="password" autoComplete="current-password" value={currentPassphrase} onChange={(event) => setCurrentPassphrase(event.target.value)} placeholder="Enter current passphrase"/><label className="field-label" htmlFor="new-vault-pass">New passphrase <span>8 characters minimum</span></label><input className="text-field" id="new-vault-pass" type="password" autoComplete="new-password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} placeholder="Create a new passphrase"/><label className="field-label" htmlFor="confirm-vault-pass">Confirm new passphrase</label><input className="text-field" id="confirm-vault-pass" type="password" autoComplete="new-password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} placeholder="Type it again"/>{vaultPasswordError && <div className="inline-error"><Info size={14}/>{vaultPasswordError}</div>}<div className="vault-password-form-footer"><span><Info size={13}/> Demo passphrase only; this does not encrypt stored files.</span><button type="submit" className="button button-secondary" disabled={vaultPasswordBusy || !currentPassphrase || !newPassphrase || !confirmPassphrase}>{vaultPasswordBusy ? 'Saving…' : 'Change passphrase'} <ArrowRight size={14}/></button></div></form> : <div className="vault-password-unset"><span><LockKeyhole size={15}/> No Vault passphrase is set yet. Set up the Vault before managing its passphrase.</span><button type="button" className="button button-secondary button-sm" onClick={onOpenVault}>Set up Vault <ArrowRight size={14}/></button></div>}</section>
          <section className="settings-panel privacy-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon privacy-icon"><ShieldCheck size={17} /></div><div><h2>Privacy & security</h2><p>Clear notes about what this prototype protects.</p></div></div><div className="privacy-settings-list"><div><span><LockKeyhole size={15} /></span><div><strong>Project passwords</strong><p>Local share passwords stay with local metadata. Cloud share passwords are verified by the server and should be shared separately from their links.</p></div></div><div><span><KeyRound size={15} /></span><div><strong>Vault passphrase</strong><p>Locks this demo UI only. Vault contents are not encrypted or uploaded by this prototype.</p></div></div><div><span><Link2 size={15} /></span><div><strong>Share links</strong><p>Links from this local workspace are browser-specific. Use a cloud project for links that should open on another device.</p></div></div></div></section>
        </div>
        <aside className="settings-side-column"><div className="settings-help-card"><div className="settings-help-mark"><Cloud size={21} /></div><div className="section-kicker">CLOUD WORKSPACE</div><h3>Share projects across devices.</h3><p>Sign in with Google, then create a cloud project and upload the source files. This local project list does not sync automatically.</p><button type="button" className="text-link-button" onClick={onOpenCloud}>Open cloud workspace <ArrowRight size={14} /></button><button type="button" className="text-link-button settings-marketing-link" onClick={onGoogleInfo}>Integration notes <ExternalLink size={14} /></button></div><div className="settings-danger-card"><div className="danger-icon"><Trash2 size={17} /></div><h3>Clear local data</h3><p>Remove local projects, imports, Vault metadata, and settings from this browser.</p><button type="button" className="button button-danger" onClick={onClearDemo}><RotateCcw size={15} /> Reset local data</button><small>This does not delete cloud projects or files.</small></div><div className="settings-footer-note">Cloud uploads require the signed-in API and connected Private Blob store. Local project data and Vault remain separate.</div></aside>
      </div>
    </div>
  );
}
