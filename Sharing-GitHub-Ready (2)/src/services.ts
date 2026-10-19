import type { Project, ProjectFile } from './types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** order;
  const locale = document.documentElement.lang === 'ar' ? 'ar-EG' : undefined;
  return `${value.toLocaleString(locale, { maximumFractionDigits: order === 0 ? 0 : 1 })} ${units[order]}`;
}

export function formatDate(timestamp: number | null | undefined, includeTime = false): string {
  if (!timestamp) return 'No expiration';
  const locale = document.documentElement.lang === 'ar' ? 'ar-EG' : undefined;
  return new Intl.DateTimeFormat(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(timestamp));
}

export function formatNumber(value: number): string {
  const locale = document.documentElement.lang === 'ar' ? 'ar-EG' : undefined;
  return new Intl.NumberFormat(locale).format(value);
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const arabic = document.documentElement.lang === 'ar';
  const arabicQuantity = (count: number, one: string, two: string, few: string, many: string) => {
    const form = count === 1 ? one : count === 2 ? two : count % 100 >= 3 && count % 100 <= 10 ? few : many;
    return `${count.toLocaleString('ar-EG')} ${form}`;
  };
  if (diff < 60 * 1000) return arabic ? 'الآن' : 'Just now';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return arabic ? `قبل ${arabicQuantity(mins, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return arabic ? `قبل ${arabicQuantity(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return arabic ? `قبل ${arabicQuantity(days, 'يوم', 'يومين', 'أيام', 'يوم')}` : `${days} day${days === 1 ? '' : 's'} ago`;
}

export function isExpired(project: Project, now = Date.now()) {
  return project.expiresAt !== null && project.expiresAt <= now;
}

export function shareUrl(token: string) {
  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
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

export function safeFileName(value: string) {
  return value.trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'sharing-project';
}

export function humanFileKind(file: ProjectFile) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'svg' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip' || ext === '7z') return 'archive';
  if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') return 'sheet';
  return 'document';
}
