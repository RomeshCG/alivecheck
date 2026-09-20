import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Math.round(value)} ms`;
}

export function formatRelative(iso: string | Date | null | undefined): string {
  if (!iso) return 'Never';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const delta = Date.now() - date.getTime();
  const seconds = Math.round(delta / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(2)}%`;
}
