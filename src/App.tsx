import { useCallback, useEffect, useMemo, useState } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import type { Project, ProjectFile, PrivacyMode, ToastMessage, VaultFile, VaultMetadata, WorkspaceSection } from './types';
import { seedProjects, seedSharedProject } from './demoData';
import { clearDemoStorage, downloadOne, downloadProjectZip, fileBlob, forgetFile, hashSecret, isExpired, newId, rememberFiles, verifySecret } from './services';
import { demoAnalyticsService, localProjectRepository, localShareLinkService, localSharedRepository, localVaultRepository, separateLocalVaultService } from './services/adapters';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Workspace from './components/Workspace';
import PublicSharePage from './components/PublicSharePage';
import { ConfirmDialog, CreateProjectModal, FilePreviewDialog, GoogleInfoModal, ProjectSettingsModal, ReuploadModal, ShareDialog } from './components/Dialogs';
import { canPreviewFile, copyText, ToastStack } from './components/common';
import type { WorkspaceProps } from './components/Workspace';
import { CloudApiError, cloudApi, setGoogleIdToken } from './services/cloudApi';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

type AppRoute = { type: 'landing' } | { type: 'login' } | { type: 'app' } | { type: 'share'; token: string };
 type DetailState = { id: string; collection: 'projects' | 'shared' } | null;
 type CreateValue = { name: string; files: File[]; privacy: PrivacyMode; password?: string; expiresAt: number | null };

function readRoute(): AppRoute {
  const path = window.location.pathname;
  const shareMatch = path.match(/^\/share\/([^/]+)\/?$/);
  if (shareMatch) {
    try { return { type: 'share', token: decodeURIComponent(shareMatch[1]) }; }
    catch { return { type: 'share', token: shareMatch[1] }; }
  }
  if (path === '/app' || path.startsWith('/app/')) return { type: 'app' };
  if (path === '/login' || path.startsWith('/login/')) return { type: 'login' };
  return { type: 'landing' };
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRoute());
  const [projects, setProjects] = useState<Project[]>(() => localProjectRepository.load());
  const [shared, setShared] = useState<Project[]>(() => localSharedRepository.load());
  const [vaultMeta, setVaultMeta] = useState<VaultMetadata>(() => localVaultRepository.load());
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [section, setSection] = useState<WorkspaceSection>('projects');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [detail, setDetail] = useState<DetailState>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [shareTab, setShareTab] = useState<'link' | 'qr'>('link');
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [reuploadProject, setReuploadProject] = useState<Project | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ project: Project; file: ProjectFile; blob: Blob } | null>(null);
  const [googleInfoOpen, setGoogleInfoOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, body?: string, kind: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, title, body, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4300);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname + window.location.search !== path) window.history.pushState({}, '', path);
    setRoute(readRoute());
    if (path === '/app' || path.startsWith('/app/')) setDetail(null);
  }, []);

  useEffect(() => {
    const handlePop = () => setRoute(readRoute());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => { if (route.type !== 'app' && vaultUnlocked) setVaultUnlocked(false); }, [route.type, vaultUnlocked]);

  useEffect(() => { localProjectRepository.save(projects); }, [projects]);
  useEffect(() => { localSharedRepository.save(shared); }, [shared]);
  useEffect(() => { localVaultRepository.save(vaultMeta); }, [vaultMeta]);

  useEffect(() => {
    if (!vaultUnlocked) return;
    let timeoutId = 0;
    const lockAfterIdle = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setVaultUnlocked(false);
        addToast('Vault locked', 'The demo Vault locked after 5 minutes of inactivity.', 'info');
      }, 5 * 60 * 1000);
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, lockAfterIdle, { passive: true }));
    lockAfterIdle();
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, lockAfterIdle));
    };
  }, [vaultUnlocked, addToast]);

  const updateProjectAcross = useCallback((id: string, update: (project: Project) => Project) => {
    setProjects((current) => current.map((project) => project.id === id ? update(project) : project));
    setShared((current) => current.map((project) => project.id === id ? update(project) : project));
  }, []);

  const openApp = useCallback((targetSection: WorkspaceSection = 'projects') => {
    setSection(targetSection);
    setQuery('');
    setDetail(null);
    navigate('/app');
  }, [navigate]);

  const handleGoogleCredential = useCallback(async (credential: string): Promise<{ email: string }> => {
    setGoogleIdToken(credential);
    try {
      const { user } = await cloudApi.me();
      return user;
    } catch (authError) {
      setGoogleIdToken(null);
      if (authError instanceof CloudApiError) {
        if (authError.status === 503) {
          throw new Error('Google sent an ID token, but server verification is not ready. Check GOOGLE_CLIENT_ID, DATABASE_URL, and the database migration in Vercel.');
        }
        if (authError.status === 401) {
          throw new Error('Google could not verify this account. Check the authorized website origin and make sure both client ID settings match.');
        }
        throw new Error(authError.message);
      }
      throw new Error('The server could not verify your Google sign-in. Check the API deployment and try again.');
    }
  }, []);

  const completeGoogleSignIn = useCallback((user: { email: string }) => {
    openApp('projects');
    addToast('Google account verified', `Signed in as ${user.email}. The current workspace UI still stores project data in this browser.`, 'info');
  }, [addToast, openApp]);

  const continueWithoutAccount = useCallback(() => {
    setGoogleIdToken(null);
    openApp('projects');
  }, [openApp]);

  const createProject = useCallback(async (value: CreateValue): Promise<Project> => {
    const now = Date.now();
    const passwordHash = value.privacy === 'password' && value.password ? await hashSecret(value.password) : undefined;
    const entries: ProjectFile[] = value.files.map((file) => ({
      id: newId('file'), name: file.name, size: file.size, type: file.type || 'application/octet-stream',
      modifiedAt: file.lastModified || now, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
      downloadCount: 0, demo: false,
    }));
    rememberFiles(entries.map((entry, index) => ({ id: entry.id, file: value.files[index] })));
    const created: Project = {
      id: newId('project'), token: value.privacy === 'private' ? null : localShareLinkService.createToken(), name: value.name,
      files: entries, createdAt: now, updatedAt: now, expiresAt: value.expiresAt, privacy: value.privacy,
      passwordHash, views: 0, downloads: 0,
    };
    setProjects((current) => [created, ...current]);
    return created;
  }, []);

  const saveProjectSettings = useCallback((next: Project) => {
    setProjects((current) => current.map((project) => project.id === next.id ? next : project));
    setShared((current) => current.map((project) => project.id === next.id ? next : project));
    if (detail?.id === next.id) setDetail((current) => current ? { ...current } : null);
  }, [detail]);

  const handleDownloadFile = useCallback((project: Project, file: ProjectFile) => {
    if (isExpired(project)) { addToast('This share has expired', 'Re-upload the project to make the files available again.', 'error'); return; }
    const didDownload = downloadOne(file);
    if (!didDownload) { addToast('File not available in this session', 'The demo keeps file contents in memory only. Re-upload the original file to download it again.', 'info'); return; }
    updateProjectAcross(project.id, (current) => demoAnalyticsService.recordFileDownload(current, file.id));
    addToast('Download started', file.name, 'success');
  }, [addToast, updateProjectAcross]);

  const handlePreviewFile = useCallback((project: Project, file: ProjectFile) => {
    if (isExpired(project)) { addToast('This share has expired', 'Re-upload the project before opening its files.', 'error'); return; }
    if (!canPreviewFile(file)) { addToast('Preview not available', 'Download the file to open it in a compatible app.', 'info'); return; }
    const blob = fileBlob(file);
    if (!blob) { addToast('File not available in this session', 'Re-upload the original file to preview it again.', 'info'); return; }
    setPreviewTarget({ project, file, blob });
  }, [addToast]);

  const handleDownloadAll = useCallback(async (project: Project) => {
    if (isExpired(project)) { addToast('This share has expired', 'Re-upload the project to make the files available again.', 'error'); return; }
    try {
      const availableFileIds = project.files.filter((file) => fileBlob(file) !== null).map((file) => file.id);
      const result = await downloadProjectZip(project);
      if (!result.downloaded) {
        addToast('No files available to package', 'Original selected files may not be present after a page refresh. Re-upload them to create a new ZIP.', 'info');
        return;
      }
      updateProjectAcross(project.id, (current) => demoAnalyticsService.recordPackageDownload(current, availableFileIds.slice(0, result.downloaded)));
      addToast(result.missing ? 'ZIP downloaded with available files' : 'Project ZIP downloaded', result.missing ? `${result.downloaded} available files included; ${result.missing} need to be re-uploaded.` : `${result.downloaded} files included in the package.`, result.missing ? 'info' : 'success');
    } catch {
      addToast('Could not create the ZIP', 'Try downloading individual files instead.', 'error');
    }
  }, [addToast, updateProjectAcross]);

  const importProject = useCallback((source: Project) => {
    const exists = shared.some((project) => project.token && project.token === source.token || project.id === source.id);
    if (exists) return;
    const imported: Project = {
      ...source, id: newId('import'), isImported: true, ownerLabel: 'A collaborator',
      createdAt: Date.now(), updatedAt: Date.now(), views: 0, downloads: 0,
      files: source.files.map((file) => ({ ...file, downloadCount: 0 })),
    };
    // Demo content files are available locally for samples; selected files remain session-only.
    setShared((current) => [imported, ...current]);
  }, [shared]);

  const handleReupload = useCallback((project: Project, files: File[]) => {
    const now = Date.now();
    const fileEntries: ProjectFile[] = files.map((file) => ({
      id: newId('file'), name: file.name, size: file.size, type: file.type || 'application/octet-stream',
      modifiedAt: file.lastModified || now, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
      downloadCount: 0, demo: false,
    }));
    rememberFiles(fileEntries.map((entry, index) => ({ id: entry.id, file: files[index] })));
    updateProjectAcross(project.id, (current) => ({
      ...current, files: fileEntries, updatedAt: now, token: current.privacy === 'private' ? null : localShareLinkService.createToken(),
      expiresAt: current.privacy === 'private' ? current.expiresAt : now + 7 * 24 * 60 * 60 * 1000,
      downloads: current.downloads,
    }));
    setReuploadProject(null);
    setDetail({ id: project.id, collection: 'projects' });
  }, [updateProjectAcross]);

  const viewProject = useCallback((project: Project, collection: 'projects' | 'shared' = 'projects') => {
    setSection('projects'); setQuery(''); setDetail({ id: project.id, collection });
  }, []);

  const projectForShare = useMemo(() => {
    if (route.type !== 'share') return null;
    return [...projects, ...shared].find((project) => project.token === route.token) ?? null;
  }, [route, projects, shared]);
  const importedAlready = !!projectForShare && shared.some((project) => project.token === projectForShare.token);
  const detailProject = useMemo(() => {
    if (!detail) return null;
    return (detail.collection === 'shared' ? shared : projects).find((project) => project.id === detail.id) || null;
  }, [detail, projects, shared]);

  const markViewed = useCallback((project: Project) => {
    updateProjectAcross(project.id, (current) => demoAnalyticsService.recordView(current));
  }, [updateProjectAcross]);

  const handleVaultSetup = useCallback(async (passphrase: string) => {
    const passwordHash = await hashSecret(passphrase);
    setVaultMeta((current) => ({ ...current, passwordHash, createdAt: current.createdAt || Date.now() }));
    setVaultUnlocked(true);
    addToast('Vault is ready', 'Your passphrase is separate from project share passwords.', 'success');
  }, [addToast]);

  const handleVaultUnlock = useCallback(async (passphrase: string) => {
    if (!vaultMeta.passwordHash) return;
    const matches = await verifySecret(passphrase, vaultMeta.passwordHash);
    if (matches) { setVaultUnlocked(true); addToast('Vault unlocked', 'It will lock after five minutes of inactivity.', 'success'); }
    else addToast('That passphrase didn’t match', 'Try again. Your Vault filenames remain hidden while locked.', 'error');
  }, [vaultMeta.passwordHash, addToast]);

  const handleVaultPasswordChange = useCallback(async (currentPassphrase: string, nextPassphrase: string) => {
    if (!vaultMeta.passwordHash) return false;
    try {
      const matches = await verifySecret(currentPassphrase, vaultMeta.passwordHash);
      if (!matches) return false;
      const passwordHash = await hashSecret(nextPassphrase);
      setVaultMeta((current) => ({ ...current, passwordHash }));
      setVaultUnlocked(false);
      return true;
    } catch { return false; }
  }, [vaultMeta.passwordHash]);

  const handleVaultAdd = useCallback((files: File[]) => {
    const added: VaultFile[] = files.map((file) => ({ id: newId('vault-file'), name: file.name, size: file.size, type: file.type || 'application/octet-stream', addedAt: Date.now() }));
    rememberFiles(added.map((entry, index) => ({ id: entry.id, file: files[index] })));
    setVaultMeta((current) => separateLocalVaultService.addFiles(current, added));
    addToast('Added to your Vault', `${added.length} local ${added.length === 1 ? 'file' : 'files'} added. File contents are not persisted by the demo.`, 'success');
  }, [addToast]);

  const handleVaultDelete = useCallback((id: string) => {
    setVaultMeta((current) => separateLocalVaultService.removeFile(current, id));
  }, []);

  const resetDemo = useCallback(() => {
    clearDemoStorage();
    const nextProjects = seedProjects();
    const nextShared = [seedSharedProject()];
    const nextVault = { passwordHash: null, files: [] } as VaultMetadata;
    setProjects(nextProjects); setShared(nextShared); setVaultMeta(nextVault); setVaultUnlocked(false);
    setDetail(null); setSection('projects'); setQuery(''); setSort('updated');
    setClearConfirmOpen(false); setDeleteProject(null); setShareProject(null); setEditProject(null); setReuploadProject(null);
    addToast('Demo data reset', 'The original sample workspace has been restored.', 'success');
  }, [addToast]);

  const storageBytes = useMemo(() => {
    const text = JSON.stringify({ projects, shared, vaultMeta });
    return new TextEncoder().encode(text).length;
  }, [projects, shared, vaultMeta]);

  const onSection = (next: WorkspaceSection) => {
    if (section === 'vault' && next !== 'vault') setVaultUnlocked(false);
    setSection(next); setDetail(null); setQuery('');
  };

  const openShareDialog = useCallback((project: Project, tab: 'link' | 'qr' = 'link') => {
    setShareProject(project);
    setShareTab(tab);
  }, []);

  const copyProjectLink = useCallback(async (project: Project) => {
    if (!project.token || isExpired(project)) {
      addToast('No active share link', project.privacy === 'private' ? 'Change this project’s access setting before sharing.' : 'Re-upload this project to create a new demo link.', 'info');
      return;
    }
    try {
      await copyText(localShareLinkService.urlFor(project.token));
      addToast('Link copied', 'This demo link resolves in the current browser profile.', 'success');
    } catch {
      addToast('Could not copy the link', 'Open the share dialog to copy the link manually.', 'error');
    }
  }, [addToast]);

  const workspaceProps: WorkspaceProps = {
    projects, shared, section, onSection, query, onQuery: setQuery, sort, onSort: setSort,
    detailProject, detailReadOnly: detail?.collection === 'shared',
    onOpenProject: viewProject,
    onBack: () => setDetail(null),
    onCreate: () => setCreateOpen(true),
    onShare: openShareDialog,
    onCopyLink: (project) => { void copyProjectLink(project); },
    onEdit: setEditProject,
    onDelete: setDeleteProject,
    onReupload: setReuploadProject,
    onDownload: handleDownloadFile,
    onPreview: handlePreviewFile,
    onDownloadAll: handleDownloadAll,
    onImport: importProject,
    onFilesDropped: (files) => { setPendingDropFiles(files); setCreateOpen(true); setSection('projects'); setDetail(null); },
    onNavigateShare: (project) => project.token ? navigate(`/share/${encodeURIComponent(project.token)}`) : addToast('No active share link', 'This project is not shareable right now.', 'info'),
    vaultMeta, vaultUnlocked,
    onVaultSetup: (value) => { void handleVaultSetup(value); },
    onVaultUnlock: (value) => { void handleVaultUnlock(value); },
    onVaultLock: () => { setVaultUnlocked(false); addToast('Vault locked', 'Your private demo area is closed.', 'info'); },
    onVaultAdd: handleVaultAdd, onVaultDelete: handleVaultDelete,
    storageBytes, onClearDemo: () => setClearConfirmOpen(true),
    onToast: addToast, onOpenGoogleInfo: () => setGoogleInfoOpen(true), onOpenMarketing: () => navigate('/welcome'), onOpenVault: () => onSection('vault'), onChangeVaultPassphrase: handleVaultPasswordChange,
  };

  return (
    <>
      {route.type === 'landing' && <LandingPage onOpenApp={() => navigate('/login')} onOpenVault={() => openApp('vault')} />}
      {route.type === 'login' && <LoginPage clientId={googleClientId} onGoogleCredential={handleGoogleCredential} onGoogleSuccess={completeGoogleSignIn} onContinueWithoutAccount={continueWithoutAccount} onBack={() => { setGoogleIdToken(null); navigate('/welcome'); }} />}
      {route.type === 'app' && <Workspace {...workspaceProps} />}
      {route.type === 'share' && <PublicSharePage
        project={projectForShare}
        onGoHome={() => navigate('/welcome')}
        onOpenApp={() => openApp('projects')}
        onOpenShared={() => openApp('shared')}
        onViewed={markViewed}
        onDownloadFile={handleDownloadFile}
        onPreviewFile={handlePreviewFile}
        onDownloadAll={(project) => { void handleDownloadAll(project); }}
        onImport={importProject}
        imported={importedAlready}
        onToast={addToast}
      />}
      {createOpen && <CreateProjectModal initialFiles={pendingDropFiles || undefined} onClose={() => { setCreateOpen(false); setPendingDropFiles(null); }} onCreate={createProject} onOpen={(project) => { setCreateOpen(false); setPendingDropFiles(null); navigate('/app'); viewProject(project); }} onToast={addToast} />}
      {shareProject && <ShareDialog project={shareProject} initialTab={shareTab} onClose={() => setShareProject(null)} onToast={addToast} />}
      {previewTarget && <FilePreviewDialog file={previewTarget.file} blob={previewTarget.blob} onClose={() => setPreviewTarget(null)} onDownload={() => { handleDownloadFile(previewTarget.project, previewTarget.file); setPreviewTarget(null); }} />}
      {editProject && <ProjectSettingsModal project={editProject} onClose={() => setEditProject(null)} onSave={saveProjectSettings} onToast={addToast} />}
      {reuploadProject && <ReuploadModal project={reuploadProject} onClose={() => setReuploadProject(null)} onSave={(files) => handleReupload(reuploadProject, files)} onToast={addToast} />}
      {deleteProject && <ConfirmDialog title={`Delete “${deleteProject.name}”?`} body="This removes the local project record and demo share link from this browser. It does not delete an uploaded cloud copy because no cloud storage is connected." confirmLabel="Delete local record" destructive onClose={() => setDeleteProject(null)} onConfirm={() => { const selectedId = deleteProject.id; deleteProject.files.forEach((file) => forgetFile(file.id)); setProjects((current) => current.filter((project) => project.id !== selectedId)); if (detail?.id === selectedId) setDetail(null); setDeleteProject(null); addToast('Project deleted', 'Local project metadata was removed.', 'success'); }} />}
      {clearConfirmOpen && <ConfirmDialog title="Reset this demo workspace?" body="This permanently clears project metadata, imported demo items, and Vault metadata from this browser, then restores the sample workspace. Files you selected are not saved by the demo." confirmLabel="Reset demo data" destructive onClose={() => setClearConfirmOpen(false)} onConfirm={resetDemo} />}
      {googleInfoOpen && <GoogleInfoModal clientConfigured={Boolean(googleClientId)} onClose={() => setGoogleInfoOpen(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
