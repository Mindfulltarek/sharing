import { useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDownAZ, ArrowLeft, ArrowRight, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Cloud, Download, Eye, FolderOpen, HardDrive, Home, KeyRound, LayoutGrid, Link2, LockKeyhole, LogOut, MoreHorizontal, Plus, QrCode, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react';
import type { Project, ProjectFile, CloudVaultState, VaultFile, WorkspaceSection } from '../types';
import { ExpirationLabel, FileGlyph, Logo, PrivacyBadge, ProjectFileList, totalSize } from './common';
import { formatBytes, formatDate, formatNumber, isExpired, timeAgo } from '../services';
import VaultView from './VaultView';
import SettingsView from './SettingsView';
import { QRCodeSVG } from 'qrcode.react';
import { LanguageToggle, useLanguage } from '../i18n';

export interface WorkspaceProps {
  projects: Project[];
  shared: Project[];
  accountEmail?: string;
  cloudLoading: boolean;
  cloudError: string;
  section: WorkspaceSection;
  onSection: (section: WorkspaceSection) => void;
  query: string;
  onQuery: (query: string) => void;
  sort: string;
  onSort: (sort: string) => void;
  detailProject: Project | null;
  detailReadOnly: boolean;
  onOpenProject: (project: Project, source?: 'projects' | 'shared') => void;
  onBack: () => void;
  onCreate: () => void;
  onShare: (project: Project, tab?: 'link' | 'qr') => void;
  onCopyLink: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDownload: (project: Project, file: ProjectFile) => void;
  onPreview: (project: Project, file: ProjectFile) => void;
  onDownloadAll: (project: Project) => void;
  onRemoveShared: (project: Project) => void;
  onFilesDropped: (files: File[]) => void;
  onNavigateShare: (project: Project) => void;
  vaultMeta: CloudVaultState;
  vaultUnlocked: boolean;
  onVaultSetup: (passphrase: string) => Promise<void>;
  onVaultUnlock: (passphrase: string) => Promise<void>;
  onVaultLock: () => void;
  onVaultAdd: (files: File[]) => Promise<void>;
  onVaultDownload: (file: VaultFile) => Promise<void>;
  onVaultDelete: (fileId: string) => Promise<void>;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
  onOpenGoogleInfo: () => void;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  onOpenVault: () => void;
  onChangeVaultPassphrase: (current: string, next: string) => Promise<boolean>;
}

const navItems: Array<{ id: WorkspaceSection; label: string; icon: typeof FolderOpen }> = [
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'vault', label: 'Vault', icon: LockKeyhole },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Workspace(props: WorkspaceProps) {
  const {
    projects, shared, accountEmail, cloudLoading, cloudError, section, onSection, query, onQuery, sort, onSort, detailProject, detailReadOnly,
    onOpenProject, onBack, onCreate, onShare, onCopyLink, onEdit, onDelete, onDownload, onPreview,
    onDownloadAll, onRemoveShared, onFilesDropped, onNavigateShare, vaultMeta, vaultUnlocked, onVaultSetup,
    onVaultUnlock, onVaultLock, onVaultAdd, onVaultDownload, onVaultDelete,
    onToast, onOpenGoogleInfo, onSignInWithGoogle, onSignOut, onOpenVault, onChangeVaultPassphrase,
  } = props;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [externalDrag, setExternalDrag] = useState(false);
  const dragDepth = useRef(0);
  const { t } = useLanguage();
  const sectionLabel = navItems.find((item) => item.id === section)?.label || 'Projects';
  const showSearch = section === 'projects' || section === 'shared';
  const fileDrag = (event: React.DragEvent) => Array.from(event.dataTransfer.types || []).includes('Files');
  const handleShellDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!fileDrag(event)) return;
    if (event.target instanceof Element && event.target.closest('.modal-backdrop, .modal-panel, .file-dropzone, .reupload-drop')) return;
    event.preventDefault(); dragDepth.current += 1; setExternalDrag(true);
  };
  const handleShellDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (fileDrag(event)) event.preventDefault();
  };
  const handleShellDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    dragDepth.current = 0; setExternalDrag(false);
  };
  const handleShellDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!fileDrag(event)) return;
    event.preventDefault(); dragDepth.current = 0; setExternalDrag(false);
    const target = event.target as HTMLElement;
    if (target.closest('.file-dropzone, .reupload-drop, .modal-panel')) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) return;
    if (section === 'vault') {
      if (vaultUnlocked) void onVaultAdd(files).catch((error: unknown) => onToast('Vault upload failed', error instanceof Error ? error.message : 'Could not upload these files.', 'error'));
      else onToast('Vault is locked', 'Unlock it before dropping files into the cloud Vault.', 'error');
      return;
    }
    onFilesDropped(files);
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} onDragEnter={handleShellDragEnter} onDragOver={handleShellDragOver} onDragLeave={handleShellDragLeave} onDrop={handleShellDrop}>
      {externalDrag && <div className="global-drop-indicator" role="status" aria-live="polite"><span className="global-drop-indicator-icon"><Cloud size={17} /></span><span><strong>{section === 'vault' ? vaultUnlocked ? t('Drop into your private Vault') : t('Unlock the Vault before adding files') : t('Drop files to start a new project')}</strong><small>{section === 'vault' ? t('Files upload to your separate cloud Vault') : t('The project flow will open with your files selected')}</small></span></div>}
      <aside className="app-sidebar">
        <div className="sidebar-topline"><button className="sidebar-brand" onClick={() => { onSection('projects'); onBack(); }} aria-label={t('Go to Sharing projects')}><Logo /></button><button className="sidebar-collapse" type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')} title={sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')}>{sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">{t('WORKSPACE')}</div>
        <nav className="sidebar-nav" aria-label={t('Workspace sections')}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`sidebar-nav-item${section === id ? ' sidebar-nav-active' : ''}`} onClick={() => onSection(id)} aria-label={t(label)} title={sidebarCollapsed ? t(label) : undefined} aria-current={section === id ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.8} /><span>{t(label)}</span>{id === 'shared' && shared.length > 0 && <span className="nav-count">{shared.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-create-card">
          <div className="sidebar-create-icon"><Sparkles size={17} /></div>
          <strong>{t('Start a new handoff')}</strong>
          <span>{t('Bring a few files together.')}</span>
          <button onClick={onCreate}><Plus size={15} /> {t('New project')}</button>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-status"><span className="status-pulse" /><span>{t('Google account connected')}</span></div>
        <button className="sidebar-profile" onClick={onSignOut} aria-label={t('Sign out of Google account')} title={t('Sign out')}><span className="profile-avatar">G</span><span><strong>{accountEmail || t('Google account')}</strong><small>{t('Sign out')}</small></span><LogOut size={17} /></button>
      </aside>

      <main className="app-main">
        <header className="workspace-topbar">
          <div className="topbar-crumb"><span>{t('Workspace')}</span><span className="crumb-slash">/</span><strong>{detailProject ? detailProject.name : t(sectionLabel)}</strong></div>
          <div className="topbar-actions">
            <LanguageToggle />
            {showSearch && !detailProject && <label className="top-search"><Search size={16} /><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t(section === 'shared' ? 'Search shared projects' : 'Search projects')} aria-label={t(section === 'shared' ? 'Search shared projects' : 'Search projects')} />{query && <button type="button" onClick={() => onQuery('')} aria-label={t('Clear search')}><X size={14} /></button>}</label>}
            <button type="button" className="button button-primary top-create-button" onClick={onCreate}><Plus size={16} /><span>{t('New project')}</span></button>
            <button className="top-avatar" type="button" onClick={() => onSection('settings')} aria-label={t('Open account and settings')}>G</button>
          </div>
        </header>

        <div className="mobile-app-brand"><Logo small /><span className="mobile-mode-tag">{t('ACCOUNT')}</span></div>
        <nav className="workspace-section-nav" aria-label={t('Primary workspace sections')}>{navItems.slice(0, 3).map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onSection(id)} className={section === id ? 'workspace-section-active' : ''} aria-current={section === id ? 'page' : undefined}><Icon size={15} /><span>{t(label)}</span>{id === 'shared' && shared.length > 0 && <i>{shared.length}</i>}</button>)}<span className="workspace-section-spacer" /><button type="button" className="workspace-settings-shortcut" onClick={() => onSection('settings')}><Settings size={14} /><span>{t('Settings')}</span></button></nav>
        <div className="mode-notice workspace-cloud-notice" role={cloudError ? 'alert' : 'status'}><span className="notice-spark"><Sparkles size={14} /></span><span><strong>{t('Google account dashboard')}</strong><i>{cloudError ? t(cloudError) : cloudLoading ? t('Loading your account projects…') : t('Projects and selected files upload to {account}. Vault is cloud-stored and separate.', { account: accountEmail || t('your Google account') })}</i></span>{cloudError && <button type="button" onClick={onSignInWithGoogle}>{t('Sign in again')} <ArrowRight size={13} /></button>}</div>

        {section === 'projects' && (detailProject ? (
          <ProjectDetail
            project={detailProject}
            readOnly={detailReadOnly}
            onBack={onBack}
            onShare={() => onShare(detailProject, 'link')}
            onShowQR={() => onShare(detailProject, 'qr')}
            onEdit={() => onEdit(detailProject)}
            onDelete={() => onDelete(detailProject)}
            onDownload={(file) => onDownload(detailProject, file)}
            onPreview={(file) => onPreview(detailProject, file)}
            onDownloadAll={() => onDownloadAll(detailProject)}
            onToast={onToast}
          />
        ) : (
          <ProjectsView projects={projects} query={query} sort={sort} loading={cloudLoading} onSort={onSort} onCreate={onCreate} onOpen={(p) => onOpenProject(p, 'projects')} onShare={onShare} onCopyLink={onCopyLink} onEdit={onEdit} onDelete={onDelete} onDownloadAll={onDownloadAll} />
        ))}

        {section === 'shared' && <SharedView shared={shared} query={query} onOpen={onNavigateShare} onRemove={onRemoveShared} />}
        {section === 'vault' && <VaultView configured={vaultMeta.configured} files={vaultMeta.files} unlocked={vaultUnlocked} onSetup={onVaultSetup} onUnlock={onVaultUnlock} onLock={onVaultLock} onAdd={onVaultAdd} onDownload={onVaultDownload} onDelete={onVaultDelete} onToast={onToast} />}
        {section === 'settings' && <SettingsView projects={projects} shared={shared} vaultConfigured={vaultMeta.configured} accountEmail={accountEmail} onSignOut={onSignOut} onGoogleInfo={onOpenGoogleInfo} onOpenVault={onOpenVault} onChangeVaultPassphrase={onChangeVaultPassphrase} onToast={onToast} />}
        <footer className="workspace-credit"><span>{t('Google account dashboard · cloud Vault stays separate.')}</span><a className="tarek-credit-button" href="https://www.instagram.com/mindfulltarek?srtk=MTJmcGt2bGp5Nmt6dw==" target="_blank" rel="noopener noreferrer">Developed by TAREK</a></footer>
      </main>

      <nav className="mobile-bottom-nav" aria-label={t('Workspace navigation')}>
        {navItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onSection(id)} className={section === id ? 'mobile-nav-active' : ''} aria-current={section === id ? 'page' : undefined}><Icon size={19} /><span>{t(label === 'Shared with me' ? 'Shared' : label)}</span></button>)}
      </nav>
    </div>
  );
}

function ProjectsView({ projects, query, sort, loading, onSort, onCreate, onOpen, onShare, onCopyLink, onEdit, onDelete, onDownloadAll }: {
  projects: Project[]; query: string; sort: string; loading: boolean; onSort: (value: string) => void; onCreate: () => void;
  onOpen: (project: Project) => void; onShare: (project: Project, tab?: 'link' | 'qr') => void; onCopyLink: (project: Project) => void; onEdit: (project: Project) => void;
  onDelete: (project: Project) => void; onDownloadAll: (project: Project) => void;
}) {
  const sorted = useMemo(() => {
    const list = projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase().trim()));
    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created') return a.createdAt - b.createdAt;
      if (sort === 'size') return totalSize(b.files) - totalSize(a.files);
      return b.updatedAt - a.updatedAt;
    });
  }, [projects, query, sort]);
  const activeCount = projects.filter((project) => !isExpired(project) && project.privacy !== 'private').length;
  const viewCount = projects.reduce((sum, project) => sum + project.views, 0);
  const downloadCount = projects.reduce((sum, project) => sum + project.downloads, 0);
  const { t } = useLanguage();

  return (
    <div className="workspace-content">
      <div className="workspace-page-heading">
        <div><div className="page-eyebrow"><span className="eyebrow-line" /> {t('YOUR SPACE')}</div><h1>{t('Your projects')}</h1><p>{t('Everything you’re preparing to share, all in one place.')}</p></div>
        <button type="button" className="button button-primary heading-create" onClick={onCreate}><Plus size={17} /> {t('Create project')}</button>
      </div>
      <div className="overview-strip">
        <div className="overview-stat"><span className="overview-icon overview-icon-violet"><FolderOpen size={17} /></span><div><strong>{projects.length.toString().padStart(2, '0')}</strong><span>{t('Projects')} <i>{t('in your account')}</i></span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-teal"><Link2 size={17} /></span><div><strong>{activeCount.toString().padStart(2, '0')}</strong><span>{t('Shareable projects')}</span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-rose"><Eye size={17} /></span><div><strong>{formatNumber(viewCount)}</strong><span>{t('Views')} <i>{t('server tracked')}</i></span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-amber"><Download size={17} /></span><div><strong>{formatNumber(downloadCount)}</strong><span>{t('Downloads')} <i>{t('server tracked')}</i></span></div></div>
      </div>
      <div className="section-row-heading"><div><h2>{t('Recent projects')} <span className="subtle-count">{sorted.length}</span></h2><p>{t('Projects and file activity from your Google account.')}</p></div><label className="sort-select"><SlidersHorizontal size={15} /><span>{t('Sort by')}</span><select value={sort} onChange={(event) => onSort(event.target.value)} aria-label={t('Sort projects')}><option value="updated">{t('Recently updated')}</option><option value="created">{t('Date created')}</option><option value="name">{t('Name')}</option><option value="size">{t('Size')}</option></select><ChevronDown size={13} /></label></div>
      {loading ? <div className="empty-state"><div className="empty-state-icon"><Cloud size={22} /></div><h3>{t('Loading your account projects…')}</h3><p>{t('Checking the Cloud API for this Google account.')}</p></div> : sorted.length ? <div className="project-grid">{sorted.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project)} onShare={() => onShare(project, 'qr')} onCopyLink={() => onCopyLink(project)} onEdit={() => onEdit(project)} onDelete={() => onDelete(project)} onDownloadAll={() => onDownloadAll(project)} />)}</div> : (
        <div className="empty-state"><div className="empty-state-icon"><Search size={22} /></div><h3>{t(query ? 'No projects found' : 'Your workspace is ready')}</h3><p>{query ? t('Try a different name or clear your search.') : t('Create a project here and its files will upload to your Google account.')}</p>{query ? <button className="button button-secondary" onClick={() => onSort('updated')}>{t('Reset sort')}</button> : <button className="button button-primary" onClick={onCreate}><Plus size={16} /> {t('Create your first project')}</button>}</div>
      )}
      <div className="workspace-footnote"><ShieldCheck size={15} /> {t('Cloud project files are stored separately from the cloud Vault.')}</div>
    </div>
  );
}

function ProjectCard({ project, onOpen, onShare, onCopyLink, onEdit, onDelete, onDownloadAll }: { project: Project; onOpen: () => void; onShare: () => void; onCopyLink: () => void; onEdit: () => void; onDelete: () => void; onDownloadAll: () => void }) {
  const expired = isExpired(project);
  const total = totalSize(project.files);
  const { t } = useLanguage();
  return (
    <article className={`project-card${expired ? ' project-card-expired' : ''}`}>
      <div className="project-card-visual" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }} aria-label={`${t('Open')} ${project.name}`}>
        <div className="project-visual-orb" />
        <div className="project-visual-top"><span className="project-card-label">{t('PROJECT')} <span>·</span> {project.files.length.toString().padStart(2, '0')} {t('FILES')}</span><ProjectMenu onShare={onShare} onCopyLink={onCopyLink} onDelete={onDelete} onEdit={onEdit} onDownloadAll={onDownloadAll} expired={expired} /></div>
        <div className="project-file-stack"><span className="stack-file stack-file-back"><FileGlyph file={project.files[1] || project.files[0]} size={20} /></span><span className="stack-file stack-file-mid"><FileGlyph file={project.files[0]} size={22} /></span><span className="stack-file stack-file-front"><FileGlyph file={project.files[2] || project.files[0]} size={19} /></span></div>
        <div className="project-visual-footer"><span className="visual-total">{formatBytes(total)}</span><span className="visual-updated">{t('Updated')} {timeAgo(project.updatedAt)}</span></div>
      </div>
      <div className="project-card-body">
        <div className="project-card-title-row"><button className="project-title-button" onClick={onOpen}>{project.name}</button><span className="project-lock-icon" title={t(project.privacy === 'password' ? 'Password protected' : project.privacy === 'private' ? 'Private project' : 'Link access')}>{project.privacy === 'password' ? <LockKeyhole size={14} /> : project.privacy === 'private' ? <ShieldCheck size={14} /> : <Link2 size={14} />}</span></div>
        <div className="project-card-meta"><span>{t('{count} files', { count: project.files.length })}</span><span className="meta-dot">·</span><span>{formatBytes(total)}</span><span className="meta-dot">·</span><span>{formatDate(project.createdAt)}</span></div>
        <div className="project-card-status-row"><PrivacyBadge project={project} compact /><ExpirationLabel project={project} /></div>
        <div className="project-card-footer"><div className="project-activity"><span title={t('Server-recorded views')}><Eye size={14} /> {formatNumber(project.views)}</span><span title={t('Server-recorded downloads')}><Download size={14} /> {formatNumber(project.downloads)}</span></div><button className="project-open-link" onClick={onOpen}>{t('Open')} <ArrowRight size={14} /></button></div>
      </div>
    </article>
  );
}

function ProjectMenu({ onShare, onCopyLink, onDelete, onEdit, onDownloadAll, expired }: { onShare: () => void; onCopyLink: () => void; onDelete: () => void; onEdit: () => void; onDownloadAll: () => void; expired: boolean }) {
  const { t } = useLanguage();
  const close = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => { action(); event.currentTarget.closest('details')?.removeAttribute('open'); };
  return (
    <details className="project-context-menu"><summary aria-label={t('Project actions')} title={t('Project actions')}><MoreHorizontal size={18} /></summary><div className="context-menu-panel" role="menu">
      {!expired && <button role="menuitem" onClick={(event) => close(event, onCopyLink)}><Link2 size={14} /> {t('Copy link')}</button>}
      {!expired && <button role="menuitem" onClick={(event) => close(event, onShare)}><QrCode size={14} /> {t('Show QR code')}</button>}
      {!expired && <button role="menuitem" onClick={(event) => close(event, onDownloadAll)}><Download size={14} /> {t('Download project')}</button>}
      {expired && <button role="menuitem" onClick={(event) => close(event, onEdit)}><SlidersHorizontal size={14} /> {t('Update expiration')}</button>}
      <div className="context-menu-separator" />
      <button role="menuitem" className="context-danger" onClick={(event) => close(event, onDelete)}><X size={14} /> {t('Delete cloud project')}</button>
    </div></details>
  );
}

function ProjectDetail({ project, readOnly, onBack, onShare, onShowQR, onEdit, onDelete, onDownload, onPreview, onDownloadAll, onToast }: {
  project: Project; readOnly: boolean; onBack: () => void; onShare: () => void; onShowQR: () => void; onEdit: () => void; onDelete: () => void;
  onDownload: (file: ProjectFile) => void; onPreview: (file: ProjectFile) => void; onDownloadAll: () => void; onToast: WorkspaceProps['onToast'];
}) {
  const expired = isExpired(project);
  const shareValue = project.token ? `${window.location.origin}/share/${project.token}` : '';
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const copyLink = async () => {
    if (!shareValue) { onToast(t('This project is private'), t('Change its access setting before sharing.'), 'info'); return; }
    try {
      await navigator.clipboard.writeText(shareValue);
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
      onToast(t('Link copied'), t('This cloud link can open on another device after Google sign-in.'));
    } catch { onShare(); }
  };
  return (
    <div className="workspace-content detail-page">
      <div className="detail-back-row"><button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> {t('All projects')}</button><span className="detail-mode-crumb">{t('GOOGLE ACCOUNT PROJECT')}</span></div>
      <div className="detail-heading-row"><div className="detail-title-block"><div className="page-eyebrow"><span className="eyebrow-line" /> {t('PROJECT OVERVIEW')}</div><div className="detail-title-line"><h1>{project.name}</h1><PrivacyBadge project={project} /></div><p>{t('{count} files', { count: project.files.length })} <span>·</span> {formatBytes(totalSize(project.files))} <span>·</span> {t('Created')} {formatDate(project.createdAt)}</p></div>
        <div className="detail-actions">{!expired && project.privacy !== 'private' && <button className="button button-primary" onClick={onShare}><Link2 size={16} /> {t('Share project')}</button>}{!readOnly && <button className="button button-secondary" onClick={onEdit}><SlidersHorizontal size={16} /> {t('Settings')}</button>}<ProjectMenu onShare={onShowQR} onCopyLink={copyLink} onDelete={onDelete} onEdit={onEdit} onDownloadAll={onDownloadAll} expired={expired} /></div>
      </div>
      {expired && <div className="expired-callout"><div className="expired-callout-icon"><Clock3 size={18} /></div><div><strong>{t('Share link expired')}</strong><span>{t('The API blocks this link after expiry. Update the expiration if stored files remain available. If cleanup removed them, create a new project and upload the originals.')}</span></div>{!readOnly && <button className="button button-secondary" onClick={onEdit}><SlidersHorizontal size={15} /> {t('Settings')}</button>}</div>}
      <div className="detail-stats-grid"><div className="detail-stat-card"><span className="detail-stat-icon violet"><Eye size={16} /></span><span className="detail-stat-value">{formatNumber(project.views)}</span><span className="detail-stat-label">{t('Project views')} <i>{t('server tracked')}</i></span></div><div className="detail-stat-card"><span className="detail-stat-icon teal"><Download size={16} /></span><span className="detail-stat-value">{formatNumber(project.downloads)}</span><span className="detail-stat-label">{t('File downloads')} <i>{t('server tracked')}</i></span></div><div className="detail-stat-card"><span className="detail-stat-icon rose"><Clock3 size={16} /></span><span className="detail-stat-value detail-stat-date">{project.expiresAt ? formatDate(project.expiresAt) : t('No expiry')}</span><span className="detail-stat-label">{t('Access expiration')} <i>{expired ? t('expired') : t('server enforced')}</i></span></div></div>
      <div className="detail-content-grid">
        <section className="detail-files-panel"><div className="panel-title-row"><div><h2>{t('Project files')} <span className="subtle-count">{project.files.length}</span></h2><p>{t('Files included in this handoff.')}</p></div><button className="button button-secondary button-sm" onClick={onDownloadAll} disabled={expired}><Download size={14} /> {t('Download all')}</button></div><ProjectFileList files={project.files} onDownload={onDownload} onPreview={onPreview} disabled={expired} />
          <div className="file-download-note"><InfoDot /> {t('Cloud files download from the account API. Vault files are kept separate.')}</div>
        </section>
        <aside className="detail-side-column">
          <div className="share-link-card"><div className="share-card-head"><div className="share-card-icon"><Link2 size={17} /></div><span>{t('SHARE ACCESS')}</span><span className={`share-state-dot ${expired || project.privacy === 'private' ? 'share-state-off' : ''}`} /></div><h3>{t(expired ? 'Share expired' : project.privacy === 'private' ? 'Kept private' : 'Your link is ready')}</h3><p>{t(expired ? 'Update the expiration in Settings if the cloud files remain available.' : project.privacy === 'private' ? 'Only this Google account can access the project.' : 'A server-backed download page for these files.')}</p>{project.token && !expired && <><div className="detail-link-field"><span>{shareValue}</span><button className="icon-button" onClick={copyLink} aria-label={t('Copy project share link')} title={t('Copy link')}>{copied ? <Check size={15} /> : <Link2 size={15} />}</button></div><button className="button button-secondary share-manage-button" onClick={onShare}><QrCode size={15} /> {t('Show QR code')}</button></>}</div>
          <div className="detail-info-card"><div className="detail-info-head"><ShieldCheck size={16} /><strong>{t('Access & privacy')}</strong></div><div className="detail-info-row"><span>{t('Who can access')}</span><strong>{t(project.privacy === 'private' ? 'Owner only' : project.privacy === 'password' ? 'Password required' : 'Anyone with link')}</strong></div><div className="detail-info-row"><span>{t('Expires')}</span><strong>{project.expiresAt ? formatDate(project.expiresAt) : t('Never')}</strong></div>{project.privacy === 'password' && <div className="privacy-hash-note"><LockKeyhole size={13} /> {t('The server verifies the password; it is never returned to this dashboard.')}</div>}</div>
        </aside>
      </div>
      <div className="workspace-footnote"><ShieldCheck size={15} /> {t('Share access and file download counts are enforced and recorded by the server.')}</div>
    </div>
  );
}

function InfoDot() { return <span className="info-dot">i</span>; }

function SharedView({ shared, query, onOpen, onRemove }: { shared: Project[]; query: string; onOpen: (project: Project) => void; onRemove: (project: Project) => void }) {
  const filtered = shared.filter((project) => project.name.toLowerCase().includes(query.toLowerCase().trim()));
  const { t } = useLanguage();
  return (
    <div className="workspace-content">
      <div className="workspace-page-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> {t('FROM YOUR COLLABORATORS')}</div><h1>{t('Shared with me')}</h1><p>{t('Projects you’ve saved from a link. You can view and download, not edit.')}</p></div><span className="shared-view-pill"><Users size={14} /> {t('Read-only access')}</span></div>
      <div className="shared-info-banner"><div className="shared-info-icon"><Link2 size={18} /></div><div><strong>{t('Saved to your account')}</strong><span>{t('These saved shares are loaded from your Google account and open while the original links remain active.')}</span></div></div>
      {filtered.length ? <div className="shared-project-list">{filtered.map((project) => <article className="shared-project-row" key={project.id}><div className="shared-project-art"><span className="shared-art-main">{project.files[0] ? <FileGlyph file={project.files[0]} size={22} /> : <FolderOpen size={22} />}</span><span className="shared-art-small">{project.files[1] || project.files[0] ? <FileGlyph file={project.files[1] || project.files[0]} size={15} /> : <FolderOpen size={15} />}</span></div><div className="shared-project-info"><div className="shared-project-title-line"><h3>{project.name}</h3><span className="read-only-badge">{t('READ ONLY')}</span></div><p>{t('From')} {project.ownerLabel || t('a collaborator')} <span>·</span> {t('{count} files', { count: project.files.length })} <span>·</span> {formatBytes(totalSize(project.files))}</p><span className="shared-expiry"><Clock3 size={13} /> {isExpired(project) ? t('Original share expired') : project.expiresAt ? t('Available until {date}', { date: formatDate(project.expiresAt) }) : t('No expiration set')}</span></div><div className="shared-project-actions"><button className="button button-secondary button-sm" onClick={() => onOpen(project)} disabled={isExpired(project)}><FolderOpen size={14} /> {t('Open')}</button><button className="button button-quiet button-sm" onClick={() => onRemove(project)} aria-label={t('Remove {name} from Shared with me', { name: project.name })}><X size={14} /> {t('Remove')}</button></div></article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><Users size={22} /></div><h3>{t(query ? 'No shared projects found' : 'No projects shared with you yet')}</h3><p>{query ? t('Try another search.') : t('When you save an active cloud share to your account, it will appear here.')}</p></div>}
      <div className="shared-import-tip"><Sparkles size={15} /><span>{t('Removing a saved share only removes it from your account list; it does not delete the owner’s project.')}</span></div>
    </div>
  );
}
