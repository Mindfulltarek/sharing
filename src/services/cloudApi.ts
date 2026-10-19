import { uploadPresigned } from '@vercel/blob/client';
import type { Project, ProjectFile, VaultFile } from '../types';

export class CloudApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CloudApiError';
    this.status = status;
    this.code = code;
  }
}

// Tokens stay in memory only. The local demo remains independent of this client.
let googleIdToken: string | null = null;
let vaultAccessToken: string | null = null;
const shareAccessTokens = new Map<string, string>();

export function setGoogleIdToken(idToken: string | null) {
  googleIdToken = idToken;
  vaultAccessToken = null;
  shareAccessTokens.clear();
}

function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  if (googleIdToken) headers.set('Authorization', `Bearer ${googleIdToken}`);
  return headers;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = authHeaders(init.headers);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  const result = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const body = result as { error?: { code?: string; message?: string } } | null;
    throw new CloudApiError(response.status, body?.error?.code || 'REQUEST_FAILED', body?.error?.message || 'The request could not be completed.');
  }
  return result as T;
}

async function requestBlob(path: string, extraHeaders?: HeadersInit) {
  const response = await fetch(path, { headers: authHeaders(extraHeaders), cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new CloudApiError(response.status, body?.error?.code || 'DOWNLOAD_FAILED', body?.error?.message || 'The file could not be downloaded.');
  }
  return response.blob();
}

async function uploadPresignedFile(
  intent: { intentId: string; pathname: string; handleUploadUrl: string },
  file: File,
) {
  if (!googleIdToken) throw new CloudApiError(401, 'AUTH_REQUIRED', 'Sign in with Google before uploading.');
  await uploadPresigned(intent.pathname, file, {
    access: 'private',
    contentType: file.type || 'application/octet-stream',
    handleUploadUrl: intent.handleUploadUrl,
    clientPayload: intent.intentId,
    headers: { Authorization: `Bearer ${googleIdToken}` },
    multipart: file.size > 4_500_000,
  });
}

export const cloudApi = {
  async me() {
    return requestJson<{ user: { googleSub: string; email: string; displayName: string; pictureUrl: string | null } }>('/api/v1/me');
  },

  async listProjects() {
    return (await requestJson<{ projects: Project[] }>('/api/v1/projects')).projects;
  },

  async createProject(input: { name: string; privacy?: 'open' | 'password' | 'private'; expiresAt?: number | null; password?: string }) {
    return (await requestJson<{ project: Project }>('/api/v1/projects', { method: 'POST', body: JSON.stringify(input) })).project;
  },

  async getProject(projectId: string) {
    return (await requestJson<{ project: Project }>(`/api/v1/projects/${encodeURIComponent(projectId)}`)).project;
  },

  async updateProject(projectId: string, input: { name?: string; privacy?: 'open' | 'password' | 'private'; expiresAt?: number | null; password?: string }) {
    return (await requestJson<{ project: Project }>(`/api/v1/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(input) })).project;
  },

  async deleteProject(projectId: string) {
    return requestJson<{ deleted: boolean }>(`/api/v1/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  },

  async rotateShareLink(projectId: string) {
    return requestJson<{ token: string }>(`/api/v1/projects/${encodeURIComponent(projectId)}/rotate-share-link`, { method: 'POST' });
  },

  async uploadProjectFile(projectId: string, file: File, relativePath?: string) {
    const intent = await requestJson<{ intentId: string; pathname: string; handleUploadUrl: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/upload-intents`,
      { method: 'POST', body: JSON.stringify({ name: file.name, size: file.size, type: file.type, relativePath }) },
    );
    await uploadPresignedFile(intent, file);
    return this.getProject(projectId);
  },

  async downloadProjectFile(projectId: string, fileId: string) {
    return requestBlob(`/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`);
  },

  async listSharedProjects() {
    return (await requestJson<{ projects: Project[] }>('/api/v1/shared')).projects;
  },

  async saveSharedProject(token: string) {
    return requestJson<{ saved: boolean }>(`/api/v1/shared/${encodeURIComponent(token)}`, { method: 'POST' });
  },

  async removeSharedProject(token: string) {
    return requestJson<{ removed: boolean }>(`/api/v1/shared/${encodeURIComponent(token)}`, { method: 'DELETE' });
  },

  async getPublicShare(token: string) {
    const accessToken = shareAccessTokens.get(token);
    const headers = accessToken ? { 'x-share-access': accessToken } : undefined;
    return requestJson<{ requiresPassword: boolean; project?: Project }>(`/api/v1/public/shares/${encodeURIComponent(token)}`, { headers });
  },

  async unlockPublicShare(token: string, password: string) {
    const result = await requestJson<{ accessToken: string }>(`/api/v1/public/shares/${encodeURIComponent(token)}/unlock`, {
      method: 'POST', body: JSON.stringify({ password }),
    });
    shareAccessTokens.set(token, result.accessToken);
    return this.getPublicShare(token);
  },

  async downloadPublicShareFile(token: string, fileId: string) {
    const accessToken = shareAccessTokens.get(token);
    return requestBlob(
      `/api/v1/public/shares/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}/download`,
      accessToken ? { 'x-share-access': accessToken } : undefined,
    );
  },

  async getVaultStatus() {
    return requestJson<{ configured: boolean }>('/api/v1/vault/status');
  },

  async setupVault(passphrase: string) {
    const result = await requestJson<{ accessToken: string; expiresInSeconds: number }>('/api/v1/vault/setup', {
      method: 'POST', body: JSON.stringify({ passphrase }),
    });
    vaultAccessToken = result.accessToken;
    return result;
  },

  async unlockVault(passphrase: string) {
    const result = await requestJson<{ accessToken: string; expiresInSeconds: number }>('/api/v1/vault/unlock', {
      method: 'POST', body: JSON.stringify({ passphrase }),
    });
    vaultAccessToken = result.accessToken;
    return result;
  },

  async changeVaultPassphrase(currentPassphrase: string, newPassphrase: string) {
    const result = await requestJson<{ accessToken: string; expiresInSeconds: number }>('/api/v1/vault/passphrase', {
      method: 'PUT', body: JSON.stringify({ currentPassphrase, newPassphrase }),
    });
    vaultAccessToken = result.accessToken;
    return result;
  },

  lockVault() {
    vaultAccessToken = null;
  },

  async listVaultFiles() {
    if (!vaultAccessToken) throw new CloudApiError(423, 'VAULT_LOCKED', 'Unlock the Vault to continue.');
    return (await requestJson<{ files: VaultFile[] }>('/api/v1/vault/files', { headers: { 'x-vault-access': vaultAccessToken } })).files;
  },

  async uploadVaultFile(file: File) {
    if (!vaultAccessToken) throw new CloudApiError(423, 'VAULT_LOCKED', 'Unlock the Vault to continue.');
    const intent = await requestJson<{ intentId: string; pathname: string; handleUploadUrl: string }>('/api/v1/vault/upload-intents', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      headers: { 'x-vault-access': vaultAccessToken },
    });
    await uploadPresignedFile(intent, file);
    return this.listVaultFiles();
  },

  async downloadVaultFile(fileId: string) {
    if (!vaultAccessToken) throw new CloudApiError(423, 'VAULT_LOCKED', 'Unlock the Vault to continue.');
    return requestBlob(`/api/v1/vault/files/${encodeURIComponent(fileId)}/download`, { 'x-vault-access': vaultAccessToken });
  },

  async deleteVaultFile(fileId: string) {
    if (!vaultAccessToken) throw new CloudApiError(423, 'VAULT_LOCKED', 'Unlock the Vault to continue.');
    return requestJson<{ deleted: boolean }>(`/api/v1/vault/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE', headers: { 'x-vault-access': vaultAccessToken },
    });
  },

  async downloadAvailableProjectFile(project: Project, file: ProjectFile) {
    if (file.available === false) throw new CloudApiError(410, 'FILE_EXPIRED', 'This file is no longer available.');
    return this.downloadProjectFile(project.id, file.id);
  },
};
