import { useState } from 'react';
import { Database, ExternalLink, HardDrive, KeyRound, Link2, LockKeyhole, LogIn, RotateCcw, ShieldCheck, Trash2, UserRound, Cloud, Info, Eye, EyeOff, ArrowRight } from 'lucide-react';
import type { Project, VaultMetadata } from '../types';
import { formatBytes } from '../services';

export default function SettingsView({ projects, shared, vaultMeta, storageBytes, onClearDemo, onGoogleInfo, onOpenMarketing, onOpenVault, onChangeVaultPassphrase, onToast }: {
  projects: Project[]; shared: Project[]; vaultMeta: VaultMetadata; storageBytes: number;
  onClearDemo: () => void; onGoogleInfo: () => void; onOpenMarketing: () => void; onOpenVault: () => void;
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
      <div className="workspace-page-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> YOUR PREFERENCES</div><h1>Settings</h1><p>Manage this local demo workspace and learn what’s coming next.</p></div><span className="settings-demo-pill"><span className="status-pulse" /> DEMO USER</span></div>
      <div className="settings-layout">
        <div className="settings-main-column">
          <section className="settings-panel profile-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon"><UserRound size={17} /></div><div><h2>Profile</h2><p>Your current demo identity.</p></div></div><div className="profile-settings-card"><span className="profile-settings-avatar">D</span><div><strong>Demo User</strong><span>Local demo workspace</span></div><span className="local-badge"><span className="status-pulse" /> LOCAL</span></div></section>
          <section className="settings-panel auth-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon auth-icon"><LogIn size={17} /></div><div><h2>Account connection</h2><p>Sign-in is deliberately non-blocking in this build.</p></div></div><div className="integration-card"><div className="google-mark" aria-hidden="true">G</div><div className="integration-copy"><strong>Google sign-in <span>Coming soon</span></strong><p>Authentication is not connected. You can use Sharing in demo mode without an account.</p></div><button className="button button-secondary button-sm" type="button" onClick={onGoogleInfo}>Learn more <ExternalLink size={13} /></button></div><div className="integration-note"><Info size={14} /> No OAuth credentials or account data are used by this demo.</div></section>
          <section className="settings-panel storage-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon storage-icon"><Database size={17} /></div><div><h2>Local demo data</h2><p>Stored in this browser, not a cloud account.</p></div></div><div className="storage-summary"><div className="storage-summary-icon"><HardDrive size={21} /></div><div className="storage-summary-copy"><strong>{formatBytes(storageBytes)}</strong><span>Estimated metadata for {projects.length} projects, {shared.length} imports, and {vaultMeta.files.length} Vault entries</span></div><span className="metadata-only-pill">METADATA ONLY</span></div><div className="storage-footnote">Selected file contents are kept in memory for this session only. This estimate is not a cloud storage quota and does not include browser storage used by unrelated sites.</div></section>
          <section className="settings-panel vault-password-settings"><div className="settings-panel-heading"><div className="settings-section-icon vault-settings-icon"><LockKeyhole size={17} /></div><div><h2>Vault passphrase</h2><p>Change the password that unlocks your separate Vault.</p></div></div>{vaultMeta.passwordHash ? <form className="vault-password-form" onSubmit={changeVaultPassword}><label className="field-label" htmlFor="current-vault-pass">Current Vault passphrase</label><input className="text-field" id="current-vault-pass" type="password" autoComplete="current-password" value={currentPassphrase} onChange={(event) => setCurrentPassphrase(event.target.value)} placeholder="Enter current passphrase"/><label className="field-label" htmlFor="new-vault-pass">New passphrase <span>8 characters minimum</span></label><input className="text-field" id="new-vault-pass" type="password" autoComplete="new-password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} placeholder="Create a new passphrase"/><label className="field-label" htmlFor="confirm-vault-pass">Confirm new passphrase</label><input className="text-field" id="confirm-vault-pass" type="password" autoComplete="new-password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} placeholder="Type it again"/>{vaultPasswordError && <div className="inline-error"><Info size={14}/>{vaultPasswordError}</div>}<div className="vault-password-form-footer"><span><Info size={13}/> Demo passphrase only; this does not encrypt stored files.</span><button type="submit" className="button button-secondary" disabled={vaultPasswordBusy || !currentPassphrase || !newPassphrase || !confirmPassphrase}>{vaultPasswordBusy ? 'Saving…' : 'Change passphrase'} <ArrowRight size={14}/></button></div></form> : <div className="vault-password-unset"><span><LockKeyhole size={15}/> No Vault passphrase is set yet. Set up the Vault before managing its passphrase.</span><button type="button" className="button button-secondary button-sm" onClick={onOpenVault}>Set up Vault <ArrowRight size={14}/></button></div>}</section>
          <section className="settings-panel privacy-settings-panel"><div className="settings-panel-heading"><div className="settings-section-icon privacy-icon"><ShieldCheck size={17} /></div><div><h2>Privacy & security</h2><p>Clear notes about what this prototype protects.</p></div></div><div className="privacy-settings-list"><div><span><LockKeyhole size={15} /></span><div><strong>Project passwords</strong><p>Stored as a one-way verifier in local demo metadata. Production needs server-side verification and rate limits.</p></div></div><div><span><KeyRound size={15} /></span><div><strong>Vault passphrase</strong><p>Locks this demo UI only. Vault contents are not encrypted or uploaded by this prototype.</p></div></div><div><span><Link2 size={15} /></span><div><strong>Share links</strong><p>Demo URLs resolve only against this browser’s local project data; they are not hosted cloud shares.</p></div></div></div></section>
        </div>
        <aside className="settings-side-column"><div className="settings-help-card"><div className="settings-help-mark"><Cloud size={21} /></div><div className="section-kicker">NEXT IN SHARING</div><h3>Real cloud, when you’re ready.</h3><p>Connect an authenticated backend and object storage to make links accessible across devices.</p><button type="button" className="text-link-button" onClick={onGoogleInfo}>See the integration notes <ExternalLink size={14} /></button><button type="button" className="text-link-button settings-marketing-link" onClick={onOpenMarketing}>Visit the marketing page <ExternalLink size={14} /></button></div><div className="settings-danger-card"><div className="danger-icon"><Trash2 size={17} /></div><h3>Clear demo data</h3><p>Remove local projects, imports, Vault metadata, and settings from this browser.</p><button type="button" className="button button-danger" onClick={onClearDemo}><RotateCcw size={15} /> Reset local demo</button><small>This cannot clear files or data you saved outside this app.</small></div><div className="settings-footer-note">Sharing is running in demo mode. Cloud uploads, Google OAuth, and server-side expiration are not configured.</div></aside>
      </div>
    </div>
  );
}
