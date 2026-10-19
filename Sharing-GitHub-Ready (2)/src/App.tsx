import { useCallback, useEffect, useState } from 'react';
import { canPreviewFile, copyText, ToastStack } from './components/common';
import type { Project, ProjectFile, PrivacyMode, ToastMessage, VaultFile, WorkspaceSection } from './types';
import { downloadBlob, isExpired, shareUrl } from './services';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Workspace from './components/Workspace';
import CloudSharePage from './components/CloudSharePage';
import { ConfirmDialog, CreateProjectModal, FilePreviewDialog, GoogleInfoModal, ProjectSettingsModal, ShareDialog } from './components/Dialogs';
import type { WorkspaceProps } from './components/Workspace';
import { CloudApiError, cloudApi, setGoogleIdToken } from './services/cloudApi';
import { useLanguage } from './i18n';

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
  if (path === '/cloud' || path.startsWith('/cloud/')) return { type: 'app' };
  if (path === '/login' || path.startsWith('/login/')) return { type: 'login' };
  return { type: 'landing' };
}

export default function App() {
  const { t } = useLanguage();
  const initialRoute = readRoute();
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [afterLoginPath, setAfterLoginPath] = useState(() => initialRoute.type === 'share' ? `${window.location.pathname}${window.location.search}` : '/app');
  const [authenticated, setAuthenticated] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [cloudEmail, setCloudEmail] = useState<string | undefined>();
  const [cloudProjects, setCloudProjects] = useState<Project[]>([]);
  const [cloudShared, setCloudShared] = useState<Project[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
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
  const [previewTarget, setPreviewTarget] = useState<{ project: Project; file: ProjectFile; blob: Blob } | null>(null);
  const [googleInfoOpen, setGoogleInfoOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, body?: string, kind: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, title: t(title), body: body ? t(body) : undefined, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4300);
  }, [t]);

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

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setCloudLoading(true);
    setCloudError('');
    Promise.all([cloudApi.listProjects(), cloudApi.listSharedProjects()])
      .then(([owned, saved]) => {
        if (!active) return;
        setCloudProjects(owned);
        setCloudShared(saved);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCloudError(error instanceof CloudApiError && error.status === 401
          ? 'Your Google session is no longer valid. Sign in again to load your account projects.'
          : error instanceof Error ? error.message : 'Cloud projects could not be loaded.');
      })
      .finally(() => { if (active) setCloudLoading(false); });
    return () => { active = false; };
  }, [authenticated, authVersion]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void cloudApi.getVaultStatus()
      .then(({ configured }) => { if (active) setVaultConfigured(configured); })
      .catch((error: unknown) => { if (active) addToast('Vault status unavailable', error instanceof Error ? error.message : 'The cloud Vault could not be checked.', 'error'); });
    return () => { active = false; };
  }, [authenticated, authVersion, addToast]);

  useEffect(() => {
    if (route.type === 'app') return;
    cloudApi.lockVault();
    setVaultUnlocked(false);
    setVaultFiles([]);
  }, [route.type]);

  useEffect(() => {
    if (authenticated && route.type === 'login') navigate(afterLoginPath || '/app');
  }, [authenticated, route.type, afterLoginPath, navigate]);

  useEffect(() => {
    if (!vaultUnlocked) return;
    let timeoutId = 0;
    const lockAfterIdle = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        cloudApi.lockVault();
        setVaultUnlocked(false);
        setVaultFiles([]);
        addToast('Vault locked', 'Your Vault locked after 5 minutes of inactivity.', 'info');
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

  const beginSignIn = useCallback((destination = '/app') => {
    setAfterLoginPath(destination);
    navigate('/login');
  }, [navigate]);

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
          throw new Error('Google sign-in reached the API, but server verification is not ready. Check GOOGLE_CLIENT_ID, DATABASE_URL, and the database migration in Vercel.');
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
    setCloudEmail(user.email);
    setAuthenticated(true);
    setAuthVersion((version) => version + 1);
    navigate(afterLoginPath || '/app');
    addToast('Google account verified', t('This dashboard is now connected to {email}; projects and selected files use your cloud account.', { email: user.email }), 'success');
  }, [afterLoginPath, addToast, navigate, t]);

  const signOutFromCloud = useCallback(() => {
    setGoogleIdToken(null);
    cloudApi.lockVault();
    setAuthenticated(false);
    setCloudEmail(undefined);
    setCloudProjects([]);
    setCloudShared([]);
    setCloudError('');
    setVaultConfigured(false);
    setVaultFiles([]);
    setVaultUnlocked(false);
    setDetail(null);
    setSection('projects');
    setAfterLoginPath('/app');
    navigate('/login');
    addToast('Signed out', 'Sign in with Google to access your cloud projects and files again.', 'info');
  }, [addToast, navigate]);

  const createCloudProject = useCallback(async (value: CreateValue): Promise<Project> => {
    let created: Project | null = null;
    try {
      created = await cloudApi.createProject({
        name: value.name,
        privacy: value.privacy,
        expiresAt: value.expiresAt,
        ...(value.privacy === 'password' && value.password ? { password: value.password } : {}),
      });
      let latest = created;
      for (const file of value.files) {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        latest = await cloudApi.uploadProjectFile(created.id, file, relativePath);
      }
      setCloudProjects((current) => [latest, ...current.filter((project) => project.id !== latest.id)]);
      return latest;
    } catch (error) {
      if (created) {
        try {
          await cloudApi.deleteProject(created.id);
          setCloudProjects((current) => current.filter((project) => project.id !== created!.id));
        } catch {
          try {
            const partial = await cloudApi.getProject(created.id);
            setCloudProjects((current) => [partial, ...current.filter((project) => project.id !== partial.id)]);
          } catch { /* Preserve the original upload error if cleanup and lookup both fail. */ }
        }
      }
      const message = error instanceof CloudApiError ? error.message : error instanceof Error ? error.message : 'Upload failed.';
      throw new Error(`The cloud project could not be completed. ${message}`);
    }
  }, []);

  const saveProjectSettings = useCallback(async (next: Project, password?: string) => {
    const updated = await cloudApi.updateProject(next.id, {
      name: next.name,
      privacy: next.privacy,
      expiresAt: next.expiresAt,
      ...(next.privacy === 'password' && password ? { password } : {}),
    });
    setCloudProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
    if (detail?.id === updated.id) setDetail((current) => current ? { ...current } : null);
    return updated;
  }, [detail]);

  const recordCloudDownload = useCallback((projectId: string, fileId: string) => {
    setCloudProjects((current) => current.map((project) => project.id !== projectId ? project : ({
      ...project,
      downloads: project.downloads + 1,
      files: project.files.map((file) => file.id === fileId ? { ...file, downloadCount: (file.downloadCount || 0) + 1 } : file),
    })));
  }, []);

  const handleDownloadFile = useCallback(async (project: Project, file: ProjectFile) => {
    if (isExpired(project)) { addToast('This share has expired', 'Update the project expiration in Settings if its stored files remain available.', 'error'); return; }
    try {
      const blob = await cloudApi.downloadAvailableProjectFile(project, file);
      downloadBlob(blob, file.name);
      recordCloudDownload(project.id, file.id);
      addToast('Download started', file.name, 'success');
    } catch (error) {
      addToast('Download failed', error instanceof Error ? error.message : 'The cloud file could not be downloaded.', 'error');
    }
  }, [addToast, recordCloudDownload]);

  const handlePreviewFile = useCallback(async (project: Project, file: ProjectFile) => {
    if (isExpired(project)) { addToast('This share has expired', 'Update the project expiration in Settings if its files remain available.', 'error'); return; }
    if (!canPreviewFile(file)) { addToast('Preview not available', 'Download the file to open it in a compatible app.', 'info'); return; }
    try {
      const blob = await cloudApi.downloadAvailableProjectFile(project, file);
      recordCloudDownload(project.id, file.id);
      setPreviewTarget({ project, file, blob });
    } catch (error) { addToast('Preview failed', error instanceof Error ? error.message : 'The cloud file could not be loaded.', 'error'); }
  }, [addToast, recordCloudDownload]);

  const handleDownloadAll = useCallback(async (project: Project) => {
    if (isExpired(project)) { addToast('This share has expired', 'Update the project expiration in Settings if its stored files remain available.', 'error'); return; }
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      let count = 0;
      for (const file of project.files) {
        if (file.available === false) continue;
        const blob = await cloudApi.downloadAvailableProjectFile(project, file);
        zip.file(file.relativePath || file.name, blob);
        recordCloudDownload(project.id, file.id);
        count++;
      }
      if (!count) { addToast('No cloud files are available', 'There are no ready files to include in this ZIP.', 'info'); return; }
      const blob = await zip.generateAsync({ type: 'blob' });
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || 'project';
      downloadBlob(blob, `${safeName}.zip`);
      addToast('Project ZIP downloaded', t('{count} cloud files included.', { count }), 'success');
    } catch (error) {
      addToast('Could not create the ZIP', error instanceof Error ? error.message : 'Try downloading individual files instead.', 'error');
    }
  }, [addToast, recordCloudDownload, t]);

  const saveCloudShare = useCallback(async (token: string) => {
    try {
      await cloudApi.saveSharedProject(token);
      setCloudShared(await cloudApi.listSharedProjects());
      addToast('Saved to your account', 'This share is now listed in Shared with me.', 'success');
      return true;
    } catch (error) {
      addToast('Could not save this share', error instanceof Error ? error.message : 'The Cloud API could not save this item.', 'error');
      return false;
    }
  }, [addToast]);

  const removeSavedShare = useCallback((project: Project) => {
    if (!project.token) return;
    void cloudApi.removeSharedProject(project.token)
      .then(() => { setCloudShared((current) => current.filter((item) => item.token !== project.token)); addToast('Share removed', 'The project was removed from your Shared with me list; the owner’s project is unchanged.', 'success'); })
      .catch((error: unknown) => addToast('Could not remove saved share', error instanceof Error ? error.message : 'The Cloud API could not remove this item.', 'error'));
  }, [addToast]);

  const handleVaultSetup = useCallback(async (passphrase: string) => {
    await cloudApi.setupVault(passphrase);
    const files = await cloudApi.listVaultFiles();
    setVaultConfigured(true);
    setVaultFiles(files);
    setVaultUnlocked(true);
    addToast('Vault is ready', 'Your separate cloud Vault is ready for files.', 'success');
  }, [addToast]);

  const handleVaultUnlock = useCallback(async (passphrase: string) => {
    await cloudApi.unlockVault(passphrase);
    const files = await cloudApi.listVaultFiles();
    setVaultFiles(files);
    setVaultUnlocked(true);
    addToast('Vault unlocked', 'It will lock after five minutes of inactivity.', 'success');
  }, [addToast]);

  const handleVaultLock = useCallback(() => {
    cloudApi.lockVault();
    setVaultUnlocked(false);
    setVaultFiles([]);
    addToast('Vault locked', 'Your private cloud area is closed.', 'info');
  }, [addToast]);

  const handleVaultAdd = useCallback(async (files: File[]) => {
    if (!vaultUnlocked) throw new Error('Unlock the Vault before adding files.');
    let latest = vaultFiles;
    for (const file of files) {
      latest = await cloudApi.uploadVaultFile(file);
      setVaultFiles(latest);
    }
    addToast('Added to your Vault', t('{count} files uploaded to your cloud Vault.', { count: files.length }), 'success');
  }, [vaultFiles, vaultUnlocked, addToast, t]);

  const handleVaultDownload = useCallback(async (file: VaultFile) => {
    const blob = await cloudApi.downloadVaultFile(file.id);
    downloadBlob(blob, file.name);
  }, []);

  const handleVaultDelete = useCallback(async (id: string) => {
    await cloudApi.deleteVaultFile(id);
    setVaultFiles((current) => current.filter((file) => file.id !== id));
  }, []);

  const handleVaultPasswordChange = useCallback(async (current: string, next: string) => {
    try {
      await cloudApi.changeVaultPassphrase(current, next);
      cloudApi.lockVault();
      setVaultUnlocked(false);
      setVaultFiles([]);
      return true;
    } catch (error) {
      addToast('Could not change Vault passphrase', error instanceof Error ? error.message : 'The cloud Vault request could not be completed.', 'error');
      return false;
    }
  }, [addToast]);

  const onSection = useCallback((next: WorkspaceSection) => {
    if (section === 'vault' && next !== 'vault') {
      cloudApi.lockVault();
      setVaultUnlocked(false);
      setVaultFiles([]);
    }
    setSection(next);
    setDetail(null);
    setQuery('');
  }, [section]);

  const openShareDialog = useCallback((project: Project, tab: 'link' | 'qr' = 'link') => {
    setShareProject(project);
    setShareTab(tab);
  }, []);

  const copyProjectLink = useCallback(async (project: Project) => {
    if (!project.token || isExpired(project)) {
      addToast('No active share link', project.privacy === 'private' ? 'Change this project’s access setting before sharing.' : 'The cloud share has expired. Update its expiration in Settings if the files remain available.', 'info');
      return;
    }
    try {
      await copyText(shareUrl(project.token));
      addToast('Link copied', 'This cloud share is served by the API and can open on another device.', 'success');
    } catch {
      addToast('Could not copy the link', 'Open the share dialog to copy the link manually.', 'error');
    }
  }, [addToast]);

  const viewProject = useCallback((project: Project, collection: 'projects' | 'shared' = 'projects') => {
    setSection('projects');
    setQuery('');
    setDetail({ id: project.id, collection });
  }, []);

  const detailProject = (() => {
    if (!detail) return null;
    return (detail.collection === 'shared' ? cloudShared : cloudProjects).find((project) => project.id === detail.id) || null;
  })();

  const workspaceProps: WorkspaceProps = {
    projects: cloudProjects,
    shared: cloudShared,
    accountEmail: cloudEmail,
    cloudLoading,
    cloudError,
    section,
    onSection,
    query,
    onQuery: setQuery,
    sort,
    onSort: setSort,
    detailProject,
    detailReadOnly: detail?.collection === 'shared',
    onOpenProject: viewProject,
    onBack: () => setDetail(null),
    onCreate: () => setCreateOpen(true),
    onShare: openShareDialog,
    onCopyLink: (project) => { void copyProjectLink(project); },
    onEdit: setEditProject,
    onDelete: setDeleteProject,
    onDownload: handleDownloadFile,
    onPreview: handlePreviewFile,
    onDownloadAll: handleDownloadAll,
    onRemoveShared: removeSavedShare,
    onFilesDropped: (files) => { setPendingDropFiles(files); setCreateOpen(true); setSection('projects'); setDetail(null); },
    onNavigateShare: (project) => project.token ? navigate(`/share/${encodeURIComponent(project.token)}`) : addToast('No active share link', 'This project is not shareable right now.', 'info'),
    vaultMeta: { configured: vaultConfigured, files: vaultFiles },
    vaultUnlocked,
    onVaultSetup: handleVaultSetup,
    onVaultUnlock: handleVaultUnlock,
    onVaultLock: handleVaultLock,
    onVaultAdd: handleVaultAdd,
    onVaultDownload: handleVaultDownload,
    onVaultDelete: handleVaultDelete,
    onToast: addToast,
    onOpenGoogleInfo: () => setGoogleInfoOpen(true),
    onSignInWithGoogle: signOutFromCloud,
    onSignOut: signOutFromCloud,
    onOpenVault: () => onSection('vault'),
    onChangeVaultPassphrase: handleVaultPasswordChange,
  };

  const showProtectedRoute = route.type === 'app' || route.type === 'share';
  const showLogin = !authenticated && (route.type === 'login' || showProtectedRoute);

  return (
    <>
      {route.type === 'landing' && <LandingPage onOpenApp={() => { if (authenticated) openApp('projects'); else { setSection('projects'); beginSignIn('/app'); } }} onOpenVault={() => { if (authenticated) openApp('vault'); else { setSection('vault'); beginSignIn('/app'); } }} />}
      {showLogin && <LoginPage clientId={googleClientId} onGoogleCredential={handleGoogleCredential} onGoogleSuccess={completeGoogleSignIn} onBack={() => { setGoogleIdToken(null); setAfterLoginPath('/app'); navigate('/welcome'); }} />}
      {route.type === 'app' && authenticated && <Workspace {...workspaceProps} />}
      {route.type === 'share' && authenticated && <CloudSharePage token={route.token} onHome={() => navigate('/welcome')} onOpenAccount={() => openApp('projects')} saved={cloudShared.some((project) => project.token === route.token)} owned={cloudProjects.some((project) => project.token === route.token)} onSaveToAccount={saveCloudShare} onToast={addToast} />}
      {createOpen && authenticated && <CreateProjectModal initialFiles={pendingDropFiles || undefined} onClose={() => { setCreateOpen(false); setPendingDropFiles(null); }} onCreate={createCloudProject} onOpen={(project) => { setCreateOpen(false); setPendingDropFiles(null); navigate('/app'); viewProject(project); }} onToast={addToast} />}
      {shareProject && <ShareDialog project={shareProject} initialTab={shareTab} onClose={() => setShareProject(null)} onToast={addToast} />}
      {previewTarget && <FilePreviewDialog file={previewTarget.file} blob={previewTarget.blob} onClose={() => setPreviewTarget(null)} onDownload={() => { void handleDownloadFile(previewTarget.project, previewTarget.file); setPreviewTarget(null); }} />}
      {editProject && <ProjectSettingsModal project={editProject} onClose={() => setEditProject(null)} onSave={saveProjectSettings} onToast={addToast} />}
      {deleteProject && <ConfirmDialog title={t('Delete “{name}”?', { name: deleteProject.name })} body="This permanently removes the account project and asks the server to delete its stored cloud files. This does not affect the separate cloud Vault." confirmLabel="Delete cloud project" destructive onClose={() => setDeleteProject(null)} onConfirm={async () => {
        const target = deleteProject;
        try {
          await cloudApi.deleteProject(target.id);
          setCloudProjects((current) => current.filter((project) => project.id !== target.id));
          if (detail?.id === target.id) setDetail(null);
          setDeleteProject(null);
          addToast('Cloud project deleted', 'The account project and its cloud files were removed.', 'success');
        } catch (error) { addToast('Could not delete cloud project', error instanceof Error ? error.message : 'The Cloud API could not delete this project.', 'error'); }
      }} />}
      {googleInfoOpen && <GoogleInfoModal clientConfigured={Boolean(googleClientId)} onClose={() => setGoogleInfoOpen(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
