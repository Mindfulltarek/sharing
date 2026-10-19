import type { AnalyticsService, AuthService, ExpirationService, ProjectRepository, ShareLinkService, StorageProvider, VaultRepository, VaultService } from './ports';
import type { Project, VaultMetadata } from '../types';
import { isExpired, loadProjects, loadSharedProjects, loadVaultMetadata, newShareToken, shareUrl, writeProjects, writeSharedProjects, writeVaultMetadata } from '../services';

export const localDemoAuthService: AuthService = {
  async getSession() {
    return { subject: 'local-demo', displayName: 'Demo User', mode: 'demo' };
  },
  async connectGoogle() {
    throw new Error('Google sign-in is not configured in the local demo.');
  },
};

/** No network or pretend upload behavior: missing storage must fail clearly. */
export const unconfiguredStorageProvider: StorageProvider = {
  configured: false,
  async upload() { throw new Error('Cloud storage is not configured.'); },
  async downloadUrl() { throw new Error('Cloud storage is not configured.'); },
  async deleteProjectCopy() { throw new Error('Cloud storage is not configured.'); },
};

export const localProjectRepository: ProjectRepository = {
  load: loadProjects,
  save: writeProjects,
};

export const localSharedRepository: ProjectRepository = {
  load: loadSharedProjects,
  save: writeSharedProjects,
};

export const localVaultRepository: VaultRepository = {
  load: loadVaultMetadata,
  save: writeVaultMetadata,
};

export const localShareLinkService: ShareLinkService = {
  createToken: newShareToken,
  urlFor: shareUrl,
};

export const demoExpirationService: ExpirationService = {
  isExpired,
  after: (durationMs, now = Date.now()) => now + durationMs,
};

export const demoAnalyticsService: AnalyticsService = {
  recordView: (project) => ({ ...project, views: project.views + 1 }),
  recordFileDownload: (project, fileId) => ({
    ...project,
    downloads: project.downloads + 1,
    updatedAt: Date.now(),
    files: project.files.map((file) => file.id === fileId ? { ...file, downloadCount: (file.downloadCount || 0) + 1 } : file),
  }),
  recordPackageDownload: (project, fileIds) => ({
    ...project,
    downloads: project.downloads + fileIds.length,
    updatedAt: Date.now(),
    files: project.files.map((file) => fileIds.includes(file.id) ? { ...file, downloadCount: (file.downloadCount || 0) + 1 } : file),
  }),
};

export const separateLocalVaultService: VaultService = {
  addFiles: (vault, files) => ({ ...vault, files: [...files, ...vault.files] }),
  removeFile: (vault, fileId) => ({ ...vault, files: vault.files.filter((file) => file.id !== fileId) }),
};

export const demoServicePorts = {
  auth: localDemoAuthService,
  storage: unconfiguredStorageProvider,
  projects: localProjectRepository,
  sharedProjects: localSharedRepository,
  shareLinks: localShareLinkService,
  expiration: demoExpirationService,
  analytics: demoAnalyticsService,
  vault: { repository: localVaultRepository, service: separateLocalVaultService },
};

// Keep a small type-level assertion close to the adapter surface as models evolve.
export function belongsToDemoWorkspace(project: Project) {
  return project.isImported === true || project.id.startsWith('demo-') || project.id.startsWith('project-');
}

export function blankVault(): VaultMetadata {
  return { passwordHash: null, files: [] };
}
