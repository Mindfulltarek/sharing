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
  views: number;
  downloads: number;
  ownerLabel?: string;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

export interface CloudVaultState {
  configured: boolean;
  files: VaultFile[];
}

export type WorkspaceSection = 'projects' | 'shared' | 'vault' | 'settings';

export type ToastMessage = {
  id: number;
  title: string;
  body?: string;
  kind: 'success' | 'error' | 'info';
};
