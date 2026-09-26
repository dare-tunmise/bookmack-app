import { formatDate } from '@/lib/loans';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const ago = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'} ago`;

// "just now", "5 minutes ago", "2 hours ago", "3 days ago", then "on 3 Sep 2026".
export function timeAgo(iso: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS) return ago(Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return ago(Math.floor(elapsed / HOUR_MS), 'hour');
  if (elapsed < 7 * DAY_MS) return ago(Math.floor(elapsed / DAY_MS), 'day');
  return `on ${formatDate(iso)}`;
}
