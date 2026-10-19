import { useState } from 'react';
import { ArrowRight, Cloud, Database, Info, KeyRound, Link2, LockKeyhole, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import type { Project } from '../types';
import { useLanguage } from '../i18n';

export default function SettingsView({ projects, shared, vaultConfigured, accountEmail, onSignOut, onGoogleInfo, onOpenVault, onChangeVaultPassphrase, onToast }: {
  projects: Project[];
  shared: Project[];
  vaultConfigured: boolean;
  accountEmail?: string;
  onSignOut: () => void;
  onGoogleInfo: () => void;
  onOpenVault: () => void;
  onChangeVaultPassphrase: (current: string, next: string) => Promise<boolean>;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [vaultPasswordError, setVaultPasswordError] = useState('');
  const [vaultPasswordBusy, setVaultPasswordBusy] = useState(false);
  const { t } = useLanguage();

  const changeVaultPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setVaultPasswordError('');
    if (!vaultConfigured) { setVaultPasswordError('Set up the Vault first.'); return; }
    if (newPassphrase.length < 8) { setVaultPasswordError('Use at least 8 characters for the new passphrase.'); return; }
    if (newPassphrase !== confirmPassphrase) { setVaultPasswordError('The new passphrases do not match.'); return; }
    setVaultPasswordBusy(true);
    try {
      const saved = await onChangeVaultPassphrase(currentPassphrase, newPassphrase);
      if (!saved) { setVaultPasswordError('The current passphrase is incorrect or the request could not be completed.'); return; }
      setCurrentPassphrase(''); setNewPassphrase(''); setConfirmPassphrase('');
      onToast(t('Vault passphrase changed'), t('The new passphrase is active for your cloud Vault.'), 'success');
    } finally { setVaultPasswordBusy(false); }
  };

  return (
    <div className="workspace-content settings-workspace">
      <div className="workspace-page-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> {t('YOUR ACCOUNT')}</div><h1>{t('Settings')}</h1><p>{t('Manage your Google account connection, projects, and separate cloud Vault.')}</p></div><span className="settings-mode-pill"><span className="status-pulse" /> {t('GOOGLE ACCOUNT')}</span></div>
      <div className="settings-layout">
        <div className="settings-main-column">
          <section className="settings-panel profile-settings-panel">
            <div className="settings-panel-heading"><div className="settings-section-icon"><UserRound size={17} /></div><div><h2>{t('Profile')}</h2><p>{t('Signed-in account for this dashboard.')}</p></div></div>
            <div className="profile-settings-card"><span className="profile-settings-avatar">G</span><div><strong>{accountEmail || t('Google account')}</strong><span>{t('Account dashboard')}</span></div><span className="account-connected-badge"><span className="status-pulse" /> {t('CONNECTED')}</span></div>
          </section>

          <section className="settings-panel auth-settings-panel">
            <div className="settings-panel-heading"><div className="settings-section-icon auth-icon"><Cloud size={17} /></div><div><h2>{t('Account connection')}</h2><p>{t('Google sign-in is required to use the workspace.')}</p></div></div>
            <div className="integration-card"><div className="google-mark" aria-hidden="true">G</div><div className="integration-copy"><strong>{t('Google account')} <span>{t('Connected')}</span></strong><p>{t('Projects and their selected files are stored in the connected cloud services.')}</p></div><button className="button button-secondary button-sm" type="button" onClick={onSignOut}><LogOut size={13} /> {t('Sign out')}</button></div>
            <div className="integration-note"><Info size={14} /> {t('Vault files are cloud-stored and remain separate from projects, shared lists, and project links.')}</div>
          </section>

          <section className="settings-panel storage-settings-panel">
            <div className="settings-panel-heading"><div className="settings-section-icon storage-icon"><Database size={17} /></div><div><h2>{t('Cloud account data')}</h2><p>{t('Project and saved-share details load from your account.')}</p></div></div>
            <div className="storage-summary">
              <div className="storage-summary-icon"><Cloud size={21} /></div>
              <div className="storage-summary-copy"><strong>{projects.length} {t('projects')} <span>·</span> {shared.length} {t('saved shares')}</strong><span>{t('Project files use the connected private cloud storage.')}</span></div>
              <span className="metadata-only-pill">{t('CLOUD')}</span>
            </div>
            <div className="storage-footnote">{t('Vault filenames are not included in project shares. Project expiration and access settings are managed by the account API.')}</div>
          </section>

          <section className="settings-panel vault-password-settings">
            <div className="settings-panel-heading"><div className="settings-section-icon vault-settings-icon"><LockKeyhole size={17} /></div><div><h2>{t('Vault passphrase')}</h2><p>{t('Change the passphrase that controls access to your separate cloud Vault.')}</p></div></div>
            {vaultConfigured ? (
              <form className="vault-password-form" onSubmit={changeVaultPassword}>
                <label className="field-label" htmlFor="current-vault-pass">{t('Current Vault passphrase')}</label>
                <input className="text-field" id="current-vault-pass" type="password" autoComplete="current-password" value={currentPassphrase} onChange={(event) => setCurrentPassphrase(event.target.value)} placeholder={t('Enter current passphrase')} />
                <label className="field-label" htmlFor="new-vault-pass">{t('New passphrase')} <span>{t('8 characters minimum')}</span></label>
                <input className="text-field" id="new-vault-pass" type="password" autoComplete="new-password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} placeholder={t('Create a new passphrase')} />
                <label className="field-label" htmlFor="confirm-vault-pass">{t('Confirm new passphrase')}</label>
                <input className="text-field" id="confirm-vault-pass" type="password" autoComplete="new-password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} placeholder={t('Type it again')} />
                {vaultPasswordError && <div className="inline-error" role="alert"><Info size={14} /> {t(vaultPasswordError)}</div>}
                <div className="vault-password-form-footer"><span><Info size={13} /> {t('The passphrase gates Vault API access. It is separate from project share passwords.')}</span><button type="submit" className="button button-secondary" disabled={vaultPasswordBusy || !currentPassphrase || !newPassphrase || !confirmPassphrase}>{vaultPasswordBusy ? t('Saving…') : t('Change passphrase')} <ArrowRight size={14} /></button></div>
              </form>
            ) : <div className="vault-password-unset"><span><LockKeyhole size={15} /> {t('No Vault passphrase is set yet.')}</span><button type="button" className="button button-secondary button-sm" onClick={onOpenVault}>{t('Set up Vault')} <ArrowRight size={14} /></button></div>}
          </section>

          <section className="settings-panel privacy-settings-panel">
            <div className="settings-panel-heading"><div className="settings-section-icon privacy-icon"><ShieldCheck size={17} /></div><div><h2>{t('Privacy & security')}</h2><p>{t('How this dashboard separates account data.')}</p></div></div>
            <div className="privacy-settings-list">
              <div><span><LockKeyhole size={15} /></span><div><strong>{t('Google account required')}</strong><p>{t('The workspace and cloud share pages require Google sign-in.')}</p></div></div>
              <div><span><KeyRound size={15} /></span><div><strong>{t('Vault passphrase')}</strong><p>{t('The passphrase gates Vault access. Vault content is not part of project shares.')}</p></div></div>
              <div><span><Link2 size={15} /></span><div><strong>{t('Project links')}</strong><p>{t('The API checks project access and any password-protected link before files are delivered.')}</p></div></div>
            </div>
          </section>
        </div>

        <aside className="settings-side-column">
          <div className="settings-help-card"><div className="settings-help-mark"><Cloud size={21} /></div><div className="section-kicker">{t('ACCOUNT DASHBOARD')}</div><h3>{t('Your projects and Vault are cloud-backed.')}</h3><p>{t('Project files upload to account storage. Vault items are stored separately and are never added to project links.')}</p><button type="button" className="text-link-button" onClick={onGoogleInfo}>{t('Integration notes')} <ArrowRight size={14} /></button></div>
          <div className="settings-side-shortcuts"><button type="button" className="button button-secondary" onClick={onOpenVault}><LockKeyhole size={15} /> {t('Open Vault')}</button><button type="button" className="button button-quiet" onClick={onSignOut}><LogOut size={15} /> {t('Sign out')}</button></div>
          <div className="settings-footer-note">{t('Cloud uploads and account access depend on the deployment’s Google, database, and private storage configuration.')}</div>
        </aside>
      </div>
    </div>
  );
}
