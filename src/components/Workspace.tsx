import { useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDownAZ, ArrowLeft, ArrowRight, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Cloud, Download, Eye, FolderOpen, HardDrive, Home, KeyRound, LayoutGrid, Link2, LockKeyhole, MoreHorizontal, Plus, QrCode, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react';
import type { Project, ProjectFile, WorkspaceSection } from '../types';
import { ExpirationLabel, FileGlyph, Logo, PrivacyBadge, ProjectFileList, totalSize } from './common';
import { formatBytes, formatDate, isExpired, timeAgo } from '../services';
import VaultView from './VaultView';
import SettingsView from './SettingsView';
import { QRCodeSVG } from 'qrcode.react';

export interface WorkspaceProps {
  projects: Project[];
  shared: Project[];
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
  onReupload: (project: Project) => void;
  onDownload: (project: Project, file: ProjectFile) => void;
  onPreview: (project: Project, file: ProjectFile) => void;
  onDownloadAll: (project: Project) => void;
  onImport: (project: Project) => void;
  onFilesDropped: (files: File[]) => void;
  onNavigateShare: (project: Project) => void;
  vaultMeta: import('../types').VaultMetadata;
  vaultUnlocked: boolean;
  onVaultSetup: (passphrase: string) => void;
  onVaultUnlock: (passphrase: string) => void;
  onVaultLock: () => void;
  onVaultAdd: (files: File[]) => void;
  onVaultDelete: (fileId: string) => void;
  storageBytes: number;
  onClearDemo: () => void;
  onToast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void;
  onOpenGoogleInfo: () => void;
  onOpenCloud: () => void;
  onOpenMarketing: () => void;
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
    projects, shared, section, onSection, query, onQuery, sort, onSort, detailProject, detailReadOnly,
    onOpenProject, onBack, onCreate, onShare, onCopyLink, onEdit, onDelete, onReupload, onDownload, onPreview,
    onDownloadAll, onImport, onFilesDropped, onNavigateShare, vaultMeta, vaultUnlocked, onVaultSetup,
    onVaultUnlock, onVaultLock, onVaultAdd, onVaultDelete, storageBytes, onClearDemo,
    onToast, onOpenGoogleInfo, onOpenCloud, onOpenMarketing, onOpenVault, onChangeVaultPassphrase,
  } = props;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [externalDrag, setExternalDrag] = useState(false);
  const dragDepth = useRef(0);
  const sectionLabel = navItems.find((item) => item.id === section)?.label || 'Projects';
  const showSearch = section === 'projects' || section === 'shared';
  const fileDrag = (event: React.DragEvent) => Array.from(event.dataTransfer.types || []).includes('Files');
  const handleShellDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!fileDrag(event)) return;
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
      if (vaultUnlocked) onVaultAdd(files);
      else onToast('Vault is locked', 'Unlock it before dropping files into the private area.', 'error');
      return;
    }
    onFilesDropped(files);
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} onDragEnter={handleShellDragEnter} onDragOver={handleShellDragOver} onDragLeave={handleShellDragLeave} onDrop={handleShellDrop}>
      {externalDrag && <div className="global-drop-overlay" role="status" aria-live="polite"><div className="global-drop-prompt"><span><Cloud size={21} /></span><strong>{section === 'vault' ? vaultUnlocked ? 'Drop into your private Vault' : 'Unlock the Vault before adding files' : 'Drop files to start a new project'}</strong><small>{section === 'vault' ? 'Files remain local to this demo browser' : 'The project flow will open with your files selected'}</small></div></div>}
      <aside className="app-sidebar">
        <div className="sidebar-topline"><button className="sidebar-brand" onClick={() => { onSection('projects'); onBack(); }} aria-label="Go to Sharing projects"><Logo /></button><button className="sidebar-collapse" type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
        <div className="sidebar-workspace-switcher"><span className="workspace-avatar">D</span><span className="switcher-text"><strong>Demo workspace</strong><small>Local browser data</small></span><ChevronDown size={15} /></div>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace sections">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`sidebar-nav-item${section === id ? ' sidebar-nav-active' : ''}`} onClick={() => onSection(id)} aria-label={label} title={sidebarCollapsed ? label : undefined} aria-current={section === id ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'shared' && shared.length > 0 && <span className="nav-count">{shared.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-create-card">
          <div className="sidebar-create-icon"><Sparkles size={17} /></div>
          <strong>Start a new handoff</strong>
          <span>Bring a few files together.</span>
          <button onClick={onCreate}><Plus size={15} /> New project</button>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-status"><span className="status-pulse" /><span>Local demo is ready</span></div>
        <button className="sidebar-profile" onClick={onOpenCloud}><span className="profile-avatar">G</span><span><strong>Local workspace</strong><small>Open Google cloud</small></span><MoreHorizontal size={18} /></button>
      </aside>

      <main className="app-main">
        <header className="workspace-topbar">
          <div className="topbar-crumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{detailProject ? detailProject.name : sectionLabel}</strong></div>
          <div className="topbar-actions">
            {showSearch && !detailProject && <label className="top-search"><Search size={16} /><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={section === 'shared' ? 'Search shared projects' : 'Search projects'} aria-label={section === 'shared' ? 'Search shared projects' : 'Search projects'} />{query && <button type="button" onClick={() => onQuery('')} aria-label="Clear search"><X size={14} /></button>}</label>}
            <button type="button" className="button button-primary top-create-button" onClick={onCreate}><Plus size={16} /><span>New project</span></button>
            <button className="top-avatar" type="button" onClick={() => onSection('settings')} aria-label="Open account and settings">D</button>
          </div>
        </header>

        <div className="mobile-app-brand"><Logo small /><span className="mobile-demo-tag">DEMO</span></div>
        <nav className="workspace-section-nav" aria-label="Primary workspace sections">{navItems.slice(0, 3).map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onSection(id)} className={section === id ? 'workspace-section-active' : ''} aria-current={section === id ? 'page' : undefined}><Icon size={15} /><span>{label}</span>{id === 'shared' && shared.length > 0 && <i>{shared.length}</i>}</button>)}<span className="workspace-section-spacer" /><button type="button" className="workspace-settings-shortcut" onClick={() => onSection('settings')}><Settings size={14} /><span>Settings</span></button></nav>
        <div className="demo-notice"><span className="notice-spark"><Sparkles size={14} /></span><span><strong>Local workspace</strong><i>Local projects and Vault stay in this browser unless uploaded separately.</i></span><button type="button" onClick={onOpenCloud}>Open cloud workspace <ArrowRight size={13} /></button></div>

        {section === 'projects' && (detailProject ? (
          <ProjectDetail
            project={detailProject}
            readOnly={detailReadOnly}
            onBack={onBack}
            onShare={() => onShare(detailProject, 'link')}
            onShowQR={() => onShare(detailProject, 'qr')}
            onEdit={() => onEdit(detailProject)}
            onDelete={() => onDelete(detailProject)}
            onReupload={() => onReupload(detailProject)}
            onDownload={(file) => onDownload(detailProject, file)}
            onPreview={(file) => onPreview(detailProject, file)}
            onDownloadAll={() => onDownloadAll(detailProject)}
            onToast={onToast}
          />
        ) : (
          <ProjectsView projects={projects} query={query} sort={sort} onSort={onSort} onCreate={onCreate} onOpen={(p) => onOpenProject(p, 'projects')} onShare={onShare} onCopyLink={onCopyLink} onEdit={onEdit} onDelete={onDelete} onReupload={onReupload} onDownloadAll={onDownloadAll} />
        ))}

        {section === 'shared' && <SharedView shared={shared} query={query} onOpen={onNavigateShare} onImport={onImport} onToast={onToast} />}
        {section === 'vault' && <VaultView vaultMeta={vaultMeta} unlocked={vaultUnlocked} onSetup={onVaultSetup} onUnlock={onVaultUnlock} onLock={onVaultLock} onAdd={onVaultAdd} onDelete={onVaultDelete} onToast={onToast} />}
        {section === 'settings' && <SettingsView projects={projects} shared={shared} vaultMeta={vaultMeta} storageBytes={storageBytes} onClearDemo={onClearDemo} onGoogleInfo={onOpenGoogleInfo} onOpenCloud={onOpenCloud} onOpenMarketing={onOpenMarketing} onOpenVault={onOpenVault} onChangeVaultPassphrase={onChangeVaultPassphrase} onToast={onToast} />}
        <footer className="workspace-credit"><span>Local browser workspace · Cloud projects are separate.</span><a href="https://www.instagram.com/mindfulltarek/" target="_blank" rel="noreferrer">Developed by TAREK</a></footer>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Workspace navigation">
        {navItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onSection(id)} className={section === id ? 'mobile-nav-active' : ''} aria-current={section === id ? 'page' : undefined}><Icon size={19} /><span>{label === 'Shared with me' ? 'Shared' : label}</span></button>)}
      </nav>
    </div>
  );
}

function ProjectsView({ projects, query, sort, onSort, onCreate, onOpen, onShare, onCopyLink, onEdit, onDelete, onReupload, onDownloadAll }: {
  projects: Project[]; query: string; sort: string; onSort: (value: string) => void; onCreate: () => void;
  onOpen: (project: Project) => void; onShare: (project: Project, tab?: 'link' | 'qr') => void; onCopyLink: (project: Project) => void; onEdit: (project: Project) => void;
  onDelete: (project: Project) => void; onReupload: (project: Project) => void; onDownloadAll: (project: Project) => void;
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

  return (
    <div className="workspace-content">
      <div className="workspace-page-heading">
        <div><div className="page-eyebrow"><span className="eyebrow-line" /> YOUR SPACE</div><h1>Your projects</h1><p>Everything you’re preparing to share, all in one place.</p></div>
        <button type="button" className="button button-primary heading-create" onClick={onCreate}><Plus size={17} /> Create project</button>
      </div>
      <div className="overview-strip">
        <div className="overview-stat"><span className="overview-icon overview-icon-violet"><FolderOpen size={17} /></span><div><strong>{projects.length.toString().padStart(2, '0')}</strong><span>Projects <i>in this demo</i></span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-teal"><Link2 size={17} /></span><div><strong>{activeCount.toString().padStart(2, '0')}</strong><span>Shareable projects</span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-rose"><Eye size={17} /></span><div><strong>{viewCount.toLocaleString()}</strong><span>Views <i>sample data</i></span></div></div>
        <div className="overview-stat"><span className="overview-icon overview-icon-amber"><Download size={17} /></span><div><strong>{downloadCount.toLocaleString()}</strong><span>Downloads <i>sample data</i></span></div></div>
      </div>
      <div className="section-row-heading"><div><h2>Recent projects <span className="subtle-count">{sorted.length}</span></h2><p>Sample metadata and analytics — not live activity.</p></div><label className="sort-select"><SlidersHorizontal size={15} /><span>Sort by</span><select value={sort} onChange={(event) => onSort(event.target.value)} aria-label="Sort projects"><option value="updated">Recently updated</option><option value="created">Date created</option><option value="name">Name</option><option value="size">Size</option></select><ChevronDown size={13} /></label></div>
      {sorted.length ? <div className="project-grid">{sorted.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project)} onShare={() => onShare(project, 'qr')} onCopyLink={() => onCopyLink(project)} onEdit={() => onEdit(project)} onDelete={() => onDelete(project)} onReupload={() => onReupload(project)} onDownloadAll={() => onDownloadAll(project)} />)}</div> : (
        <div className="empty-state"><div className="empty-state-icon"><Search size={22} /></div><h3>{query ? 'No projects found' : 'Your workspace is ready'}</h3><p>{query ? 'Try a different name or clear your search.' : 'Create a project to bring your files together.'}</p>{query ? <button className="button button-secondary" onClick={() => onSort('updated')}>Reset sort</button> : <button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create your first project</button>}</div>
      )}
      <div className="workspace-footnote"><ShieldCheck size={15} /> Activity numbers are sample demo data. No visitors are tracked outside this browser.</div>
    </div>
  );
}

function ProjectCard({ project, onOpen, onShare, onCopyLink, onEdit, onDelete, onReupload, onDownloadAll }: { project: Project; onOpen: () => void; onShare: () => void; onCopyLink: () => void; onEdit: () => void; onDelete: () => void; onReupload: () => void; onDownloadAll: () => void }) {
  const expired = isExpired(project);
  const total = totalSize(project.files);
  return (
    <article className={`project-card${expired ? ' project-card-expired' : ''}`}>
      <div className="project-card-visual" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }} aria-label={`Open ${project.name}`}>
        <div className="project-visual-orb" />
        <div className="project-visual-top"><span className="project-card-label">PROJECT <span>·</span> {project.files.length.toString().padStart(2, '0')} FILES</span><ProjectMenu onShare={onShare} onCopyLink={onCopyLink} onDelete={onDelete} onReupload={onReupload} onDownloadAll={onDownloadAll} expired={expired} /></div>
        <div className="project-file-stack"><span className="stack-file stack-file-back"><FileGlyph file={project.files[1] || project.files[0]} size={20} /></span><span className="stack-file stack-file-mid"><FileGlyph file={project.files[0]} size={22} /></span><span className="stack-file stack-file-front"><FileGlyph file={project.files[2] || project.files[0]} size={19} /></span></div>
        <div className="project-visual-footer"><span className="visual-total">{formatBytes(total)}</span><span className="visual-updated">Updated {timeAgo(project.updatedAt)}</span></div>
      </div>
      <div className="project-card-body">
        <div className="project-card-title-row"><button className="project-title-button" onClick={onOpen}>{project.name}</button><span className="project-lock-icon" title={project.privacy === 'password' ? 'Password protected' : project.privacy === 'private' ? 'Private project' : 'Link access'}>{project.privacy === 'password' ? <LockKeyhole size={14} /> : project.privacy === 'private' ? <ShieldCheck size={14} /> : <Link2 size={14} />}</span></div>
        <div className="project-card-meta"><span>{project.files.length} files</span><span className="meta-dot">·</span><span>{formatBytes(total)}</span><span className="meta-dot">·</span><span>{formatDate(project.createdAt)}</span></div>
        <div className="project-card-status-row"><PrivacyBadge project={project} compact /><ExpirationLabel project={project} /></div>
        <div className="project-card-footer"><div className="project-activity"><span title="Sample project views"><Eye size={14} /> {expired ? project.views : project.views.toLocaleString()}</span><span title="Sample file downloads"><Download size={14} /> {project.downloads}</span></div><button className="project-open-link" onClick={onOpen}>Open <ArrowRight size={14} /></button></div>
      </div>
    </article>
  );
}

function ProjectMenu({ onShare, onCopyLink, onDelete, onReupload, onDownloadAll, expired }: { onShare: () => void; onCopyLink: () => void; onDelete: () => void; onReupload: () => void; onDownloadAll: () => void; expired: boolean }) {
  const close = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => { action(); event.currentTarget.closest('details')?.removeAttribute('open'); };
  return (
    <details className="project-context-menu"><summary aria-label="Project actions" title="Project actions"><MoreHorizontal size={18} /></summary><div className="context-menu-panel" role="menu">
      {!expired && <button role="menuitem" onClick={(event) => close(event, onCopyLink)}><Link2 size={14} /> Copy link</button>}
      {!expired && <button role="menuitem" onClick={(event) => close(event, onShare)}><QrCode size={14} /> Show QR code</button>}
      {!expired && <button role="menuitem" onClick={(event) => close(event, onDownloadAll)}><Download size={14} /> Download project</button>}
      {expired && <button role="menuitem" onClick={(event) => close(event, onReupload)}><Cloud size={14} /> Re-upload project</button>}
      <div className="context-menu-separator" />
      <button role="menuitem" className="context-danger" onClick={(event) => close(event, onDelete)}><X size={14} /> Delete local record</button>
    </div></details>
  );
}

function ProjectDetail({ project, readOnly, onBack, onShare, onShowQR, onEdit, onDelete, onReupload, onDownload, onPreview, onDownloadAll, onToast }: {
  project: Project; readOnly: boolean; onBack: () => void; onShare: () => void; onShowQR: () => void; onEdit: () => void; onDelete: () => void; onReupload: () => void;
  onDownload: (file: ProjectFile) => void; onPreview: (file: ProjectFile) => void; onDownloadAll: () => void; onToast: WorkspaceProps['onToast'];
}) {
  const expired = isExpired(project);
  const shareValue = project.token ? `${window.location.origin}/share/${project.token}` : '';
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    if (!shareValue) { onToast('This project is private', 'Change its access setting before sharing.', 'info'); return; }
    try { await navigator.clipboard.writeText(shareValue); setCopied(true); window.setTimeout(() => setCopied(false), 1600); onToast('Link copied', 'This demo link works in the current browser profile.'); }
    catch { onShare(); }
  };
  return (
    <div className="workspace-content detail-page">
      <div className="detail-back-row"><button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> All projects</button><span className="detail-demo-crumb">LOCAL DEMO PROJECT</span></div>
      <div className="detail-heading-row"><div className="detail-title-block"><div className="page-eyebrow"><span className="eyebrow-line" /> PROJECT OVERVIEW</div><div className="detail-title-line"><h1>{project.name}</h1><PrivacyBadge project={project} /></div><p>{project.files.length} files <span>·</span> {formatBytes(totalSize(project.files))} <span>·</span> Created {formatDate(project.createdAt)}</p></div>
        <div className="detail-actions">{!expired && project.privacy !== 'private' && <button className="button button-primary" onClick={onShare}><Link2 size={16} /> Share project</button>}{!readOnly && <button className="button button-secondary" onClick={onEdit}><SlidersHorizontal size={16} /> Settings</button>}<ProjectMenu onShare={onShowQR} onCopyLink={copyLink} onDelete={onDelete} onReupload={onReupload} onDownloadAll={onDownloadAll} expired={expired} /></div>
      </div>
      {expired && <div className="expired-callout"><div className="expired-callout-icon"><Clock3 size={18} /></div><div><strong>Expired — local link disabled</strong><span>This browser-local project is no longer shareable. No cloud file was uploaded or deleted; select the original files again to create a new local share.</span></div>{!readOnly && <button className="button button-secondary" onClick={onReupload}><Cloud size={15} /> Re-upload</button>}</div>}
      <div className="detail-stats-grid"><div className="detail-stat-card"><span className="detail-stat-icon violet"><Eye size={16} /></span><span className="detail-stat-value">{project.views.toLocaleString()}</span><span className="detail-stat-label">Project views <i>sample data</i></span></div><div className="detail-stat-card"><span className="detail-stat-icon teal"><Download size={16} /></span><span className="detail-stat-value">{project.downloads.toLocaleString()}</span><span className="detail-stat-label">File downloads <i>sample data</i></span></div><div className="detail-stat-card"><span className="detail-stat-icon rose"><Clock3 size={16} /></span><span className="detail-stat-value detail-stat-date">{project.expiresAt ? formatDate(project.expiresAt) : 'No expiry'}</span><span className="detail-stat-label">Access expiration <i>{expired ? 'demo status' : 'configured'}</i></span></div></div>
      <div className="detail-content-grid">
        <section className="detail-files-panel"><div className="panel-title-row"><div><h2>Project files <span className="subtle-count">{project.files.length}</span></h2><p>Files included in this handoff.</p></div><button className="button button-secondary button-sm" onClick={onDownloadAll} disabled={expired}><Download size={14} /> Download all</button></div><ProjectFileList files={project.files} onDownload={onDownload} onPreview={onPreview} disabled={expired} />
          <div className="file-download-note"><InfoDot /> Files selected in a browser demo are available for this session. Large file contents are not saved to local browser storage.</div>
        </section>
        <aside className="detail-side-column">
          <div className="share-link-card"><div className="share-card-head"><div className="share-card-icon"><Link2 size={17} /></div><span>SHARE ACCESS</span><span className={`share-state-dot ${expired || project.privacy === 'private' ? 'share-state-off' : ''}`} /></div><h3>{expired ? 'Share expired' : project.privacy === 'private' ? 'Kept private' : 'Your link is ready'}</h3><p>{expired ? 'Re-upload to create a fresh demo share.' : project.privacy === 'private' ? 'Only you can see this project in your local workspace.' : 'A focused download page for these files.'}</p>{project.token && !expired && <><div className="detail-link-field"><span>{shareValue}</span><button className="icon-button" onClick={copyLink} aria-label="Copy project share link" title="Copy link">{copied ? <Check size={15} /> : <Link2 size={15} />}</button></div><button className="button button-secondary share-manage-button" onClick={onShare}><QrCode size={15} /> Show QR code</button></>}</div>
          <div className="detail-info-card"><div className="detail-info-head"><ShieldCheck size={16} /><strong>Access & privacy</strong></div><div className="detail-info-row"><span>Who can access</span><strong>{project.privacy === 'private' ? 'Owner only' : project.privacy === 'password' ? 'Password required' : 'Anyone with link'}</strong></div><div className="detail-info-row"><span>Expires</span><strong>{project.expiresAt ? formatDate(project.expiresAt) : 'Never'}</strong></div>{project.privacy === 'password' && <div className="privacy-hash-note"><LockKeyhole size={13} /> A one-way verifier is saved in this browser. Use settings to replace the passcode.</div>}</div>
        </aside>
      </div>
      <div className="workspace-footnote"><ShieldCheck size={15} /> Views and downloads shown here are sample demo data plus actions from this browser.</div>
    </div>
  );
}

function InfoDot() { return <span className="info-dot">i</span>; }

function SharedView({ shared, query, onOpen, onImport, onToast }: { shared: Project[]; query: string; onOpen: (project: Project) => void; onImport: (project: Project) => void; onToast: WorkspaceProps['onToast'] }) {
  const filtered = shared.filter((project) => project.name.toLowerCase().includes(query.toLowerCase().trim()));
  return (
    <div className="workspace-content">
      <div className="workspace-page-heading"><div><div className="page-eyebrow"><span className="eyebrow-line" /> FROM YOUR COLLABORATORS</div><h1>Shared with me</h1><p>Projects you’ve saved from a link. You can view and download, not edit.</p></div><span className="shared-view-pill"><Users size={14} /> Read-only access</span></div>
      <div className="shared-demo-banner"><div className="shared-demo-icon"><Link2 size={18} /></div><div><strong>Imported to this browser</strong><span>Saving a shared project adds its metadata to this local demo account. It does not create a real cross-account sync.</span></div></div>
      {filtered.length ? <div className="shared-project-list">{filtered.map((project) => <article className="shared-project-row" key={project.id}><div className="shared-project-art"><span className="shared-art-main"><FileGlyph file={project.files[0]} size={22} /></span><span className="shared-art-small"><FileGlyph file={project.files[1] || project.files[0]} size={15} /></span></div><div className="shared-project-info"><div className="shared-project-title-line"><h3>{project.name}</h3><span className="read-only-badge">READ ONLY</span></div><p>From {project.ownerLabel || 'a collaborator'} <span>·</span> {project.files.length} files <span>·</span> {formatBytes(totalSize(project.files))}</p><span className="shared-expiry"><Clock3 size={13} /> {isExpired(project) ? 'Original share expired' : project.expiresAt ? `Available until ${formatDate(project.expiresAt)}` : 'No expiration set'}</span></div><div className="shared-project-actions"><button className="button button-secondary button-sm" onClick={() => onOpen(project)} disabled={isExpired(project)}><FolderOpen size={14} /> Open</button><button className="button button-quiet button-sm" onClick={() => { onImport(project); onToast('Saved to Shared with me', 'This project is already in your local demo workspace.', 'info'); }}><Check size={14} /> Saved</button></div></article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><Users size={22} /></div><h3>{query ? 'No shared projects found' : 'No projects shared with you yet'}</h3><p>{query ? 'Try another search.' : 'When you import a project from a share link, it will show up here.'}</p></div>}
      <div className="shared-import-tip"><Sparkles size={15} /><span>Tip: open any active share link and choose <strong>Save to my Sharing</strong> to add a project here.</span></div>
    </div>
  );
}
