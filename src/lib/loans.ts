import type { Schemas } from '@/api/client';

type Loan = Schemas['Loan'];

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "Due tomorrow", "Overdue by 3 days", "Returned 5 Oct 2026", counted in calendar days.
export function loanDueText(loan: Loan, now = new Date()): string {
  if (loan.returnedAt) return `Returned ${formatDate(loan.returnedAt)}`;

  const days = Math.round((startOfDay(new Date(loan.dueAt)) - startOfDay(now)) / DAY_MS);
  if (days < 0) return `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${formatDate(loan.dueAt)}`;
}
