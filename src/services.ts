import JSZip from 'jszip';
import { seedProjects, seedSharedProject, getDemoContent } from './demoData';
import type { Project, ProjectFile, VaultMetadata } from './types';

const PROJECTS_KEY = 'sharing.demo.projects.v1';
const SHARED_KEY = 'sharing.demo.shared.v1';
const VAULT_KEY = 'sharing.demo.vault.v1';
const fileCache = new Map<string, File>();

function safeRead<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeProjects(projects: Project[]) {
  try { window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch { /* Storage may be unavailable in private browsing. */ }
}

export function loadProjects(): Project[] {
  const stored = safeRead<Project[]>(PROJECTS_KEY);
  if (Array.isArray(stored)) return stored;
  const seeded = seedProjects();
  writeProjects(seeded);
  return seeded;
}

export function writeSharedProjects(projects: Project[]) {
  try { window.localStorage.setItem(SHARED_KEY, JSON.stringify(projects)); } catch { /* Best-effort demo persistence. */ }
}

export function loadSharedProjects(): Project[] {
  const stored = safeRead<Project[]>(SHARED_KEY);
  if (Array.isArray(stored)) return stored;
  const seeded = [seedSharedProject()];
  writeSharedProjects(seeded);
  return seeded;
}

export function loadVaultMetadata(): VaultMetadata {
  const stored = safeRead<VaultMetadata>(VAULT_KEY);
  if (stored && Array.isArray(stored.files)) return stored;
  const initial: VaultMetadata = { passwordHash: null, files: [] };
  writeVaultMetadata(initial);
  return initial;
}

export function writeVaultMetadata(vault: VaultMetadata) {
  try { window.localStorage.setItem(VAULT_KEY, JSON.stringify(vault)); } catch { /* Best-effort demo persistence. */ }
}

export function rememberFiles(entries: Array<{ id: string; file: File }>) {
  entries.forEach(({ id, file }) => fileCache.set(id, file));
}

export function forgetFile(id: string) {
  fileCache.delete(id);
}

export function newId(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newShareToken() {
  const bytes = new Uint8Array(24);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashSecret(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Demo fallback only; production verification belongs on an authenticated server.
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `demo-${(hash >>> 0).toString(16)}`;
}

export async function verifySecret(value: string, expectedHash: string): Promise<boolean> {
  const candidate = await hashSecret(value);
  if (candidate.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) mismatch |= candidate.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return mismatch === 0;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** order;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: order === 0 ? 0 : 1 })} ${units[order]}`;
}

export function formatDate(timestamp: number | null | undefined, includeTime = false): string {
  if (!timestamp) return 'No expiration';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(timestamp));
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return 'Just now';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function isExpired(project: Project, now = Date.now()) {
  return project.expiresAt !== null && project.expiresAt <= now;
}

export function shareUrl(token: string) {
  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
}

export function fileBlob(file: ProjectFile): Blob | null {
  const original = fileCache.get(file.id);
  if (original) return original;
  const content = file.demo ? getDemoContent(file) : null;
  if (content === null) return null;
  return new Blob([content], { type: file.type || 'application/octet-stream' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadOne(file: ProjectFile): boolean {
  const blob = fileBlob(file);
  if (!blob) return false;
  downloadBlob(blob, file.name);
  return true;
}

export async function downloadProjectZip(project: Project): Promise<{ downloaded: number; missing: number }> {
  const zip = new JSZip();
  let downloaded = 0;
  let missing = 0;
  for (const file of project.files) {
    const blob = fileBlob(file);
    if (!blob) { missing++; continue; }
    zip.file(file.relativePath || file.name, blob);
    downloaded++;
  }
  if (!downloaded) return { downloaded, missing };
  zip.file('sharing-project.json', JSON.stringify({
    name: project.name,
    createdAt: new Date(project.createdAt).toISOString(),
    exportedAt: new Date().toISOString(),
    mode: 'Local demo export',
    note: 'This archive was generated in the Sharing browser demo. It does not contain files that were unavailable in this session.',
    files: project.files.map(({ id, name, size, type }) => ({ id, name, size, type })),
  }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${safeFileName(project.name)}.zip`);
  return { downloaded, missing };
}

export function safeFileName(value: string) {
  return value.trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'sharing-project';
}

export function clearDemoStorage() {
  try {
    window.localStorage.removeItem(PROJECTS_KEY);
    window.localStorage.removeItem(SHARED_KEY);
    window.localStorage.removeItem(VAULT_KEY);
  } catch { /* Ignore. */ }
  fileCache.clear();
}

export function humanFileKind(file: ProjectFile) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'svg' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip' || ext === '7z') return 'archive';
  if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') return 'sheet';
  return 'document';
}
