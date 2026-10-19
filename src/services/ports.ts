import type { Project, ProjectFile, VaultMetadata } from '../types';

export interface DemoSession {
  subject: 'local-demo';
  displayName: 'Demo User';
  mode: 'demo';
}

/** Future authentication boundary. The current implementation never starts OAuth. */
export interface AuthService {
  getSession(): Promise<DemoSession>;
  connectGoogle(): Promise<never>;
}

/** Object storage boundary. Production implementations must authorize on the server. */
export interface StorageProvider {
  readonly configured: boolean;
  upload(file: File, projectId: string): Promise<{ objectId: string }>;
  downloadUrl(objectId: string, expiresInSeconds?: number): Promise<string>;
  deleteProjectCopy(projectId: string): Promise<void>;
}

export interface ProjectRepository {
  load(): Project[];
  save(projects: Project[]): void;
}

/** Kept separate from project/share repositories by design. */
export interface VaultRepository {
  load(): VaultMetadata;
  save(vault: VaultMetadata): void;
}

export interface ShareLinkService {
  createToken(): string;
  urlFor(token: string): string;
}

export interface ExpirationService {
  isExpired(project: Project, now?: number): boolean;
  after(durationMs: number, now?: number): number;
}

export interface AnalyticsService {
  recordView(project: Project): Project;
  recordFileDownload(project: Project, fileId: string): Project;
  recordPackageDownload(project: Project, fileIds: string[]): Project;
}

export interface VaultService {
  addFiles(vault: VaultMetadata, files: Array<{ id: string; name: string; size: number; type: string; addedAt: number }>): VaultMetadata;
  removeFile(vault: VaultMetadata, fileId: string): VaultMetadata;
}

export type ProjectContent = Pick<ProjectFile, 'id' | 'name' | 'size' | 'type'>;
