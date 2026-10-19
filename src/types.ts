export type PrivacyMode = 'open' | 'password' | 'private';

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  modifiedAt?: number;
  relativePath?: string;
  downloadCount?: number;
  available?: boolean;
  demo?: boolean;
}

export interface Project {
  id: string;
  token: string | null;
  name: string;
  files: ProjectFile[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  privacy: PrivacyMode;
  passwordHash?: string;
  views: number;
  downloads: number;
  isImported?: boolean;
  ownerLabel?: string;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

export interface VaultMetadata {
  passwordHash: string | null;
  files: VaultFile[];
  createdAt?: number;
}

export type WorkspaceSection = 'projects' | 'shared' | 'vault' | 'settings';

export type ToastMessage = {
  id: number;
  title: string;
  body?: string;
  kind: 'success' | 'error' | 'info';
};
