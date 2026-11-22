import type { Schemas } from '@/api/client';

// Everything the stats screen and the two share cards say, worked out from one year's shelf.
//
// Kept away from both so there is a single answer to "how many pages was that": the cards used to
// recompute their own totals and could disagree with the screen that opened them.

type Shelf = Schemas['YearShelf'];
export type YearBook = Shelf['books'][number];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

// Days into the year, 1 for 1 January. Used for pace: a year's totals divided by the days that
// have actually happened, not by 365, or January always looks like a collapse.
export const dayOfYear = (at: Date) =>
  Math.floor((Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) - Date.UTC(at.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;

const daysInYear = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365);

export type YearStats = {
  year: number;
  // The books themselves, so the share cards and the month list read the same list the totals
  // were counted from rather than fetching or recomputing their own.
  books: YearBook[];
  count: number;
  pages: number;
  byMonth: number[];
  genres: { genre: string; count: number }[];
  // The month with the most pages, which is what the Numbers card reports.
  bestMonth: number;
  // The last month a reader could have finished anything in. Later ones are drawn as outlines.
  lastMonth: number;
  daysPerBook: number | null;
  pagesPerDay: number;
  longest: YearBook | null;
  lent: number;
  onTime: number;
};

export function deriveYear(shelf: Shelf, now = new Date()): YearStats {
  const books = shelf.books;
  const thisYear = shelf.year === now.getUTCFullYear();
  const elapsed = thisYear ? dayOfYear(now) : daysInYear(shelf.year);

  const byMonth = Array<number>(12).fill(0);
  const pagesByMonth = Array<number>(12).fill(0);
  const genreCounts = new Map<string, number>();
  let pages = 0;

  for (const book of books) {
    const month = new Date(book.finishedAt).getUTCMonth();
    byMonth[month] += 1;
    pagesByMonth[month] += book.pageCount ?? 0;
    pages += book.pageCount ?? 0;
    // Books with no category are left out rather than bucketed as "Other": the sentence says
    // "Mostly fiction, 18 of 26", and an invented genre would make that count a lie.
    if (book.category) genreCounts.set(book.category, (genreCounts.get(book.category) ?? 0) + 1);
  }

  // Only the books that were actually started have a reading span, so the average is over those.
  const timed = books.filter((book) => typeof book.days === 'number');
  const daysPerBook = timed.length
    ? Math.round(timed.reduce((total, book) => total + (book.days ?? 0), 0) / timed.length)
    : null;

  return {
    year: shelf.year,
    books,
    count: books.length,
    pages,
    byMonth,
    genres: [...genreCounts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre)),
    bestMonth: pagesByMonth.indexOf(Math.max(...pagesByMonth)),
    lastMonth: thisYear ? now.getUTCMonth() : 11,
    daysPerBook,
    pagesPerDay: Math.round(pages / elapsed),
    longest: books.reduce<YearBook | null>(
      (best, book) => ((book.pageCount ?? 0) > (best?.pageCount ?? 0) ? book : best),
      null
    ),
    lent: shelf.lending.loans,
    onTime: shelf.lending.onTime
  };
}

/**
 * The line under the goal bar. Null when no goal is set — the screen offers to set one instead of
 * inventing a target, because a number nobody chose is not an achievement.
 */
export function goalLine(stats: YearStats, goal: number | null, now = new Date()): string | null {
  if (!goal) return null;

  const left = goal - stats.count;
  if (stats.year !== now.getUTCFullYear()) {
    return left > 0 ? `${left} short of your goal of ${goal}.` : `You reached your goal of ${goal}.`;
  }

  const total = daysInYear(stats.year);
  const elapsed = dayOfYear(now);
  if (left <= 0) return `Goal reached, with ${total - elapsed} days to spare.`;

  // Where the year says you should be by today, not where the year ends.
  const expected = Math.round((goal * elapsed) / total);
  const diff = stats.count - expected;
  const pace = diff > 0 ? `you're ${diff} ahead of pace` : diff < 0 ? `you're ${-diff} behind pace` : "you're right on pace";
  return `${left} to go, and ${pace}.`;
}

export const genreLine = (stats: YearStats) =>
  stats.genres.length ? { lead: `Mostly ${stats.genres[0].genre.toLowerCase()}, `, figure: String(stats.genres[0].count), tail: ` of ${stats.count}.` } : null;

export const lendingLine = (stats: YearStats, now = new Date()) => ({
  lead: 'You lent ',
  figure: String(stats.lent),
  tail: ` book${stats.lent === 1 ? '' : 's'}${stats.year === now.getUTCFullYear() ? ' this year' : ` in ${stats.year}`}. ` +
    `${stats.onTime} came back on time.`
});

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * "At this year's pace, that's about two and a half years of reading." Null when there is no pace
 * to go on — a year with nothing finished in it cannot predict anything.
 */
export function paceLine(unread: number, finishedThisYear: number): string | null {
  if (unread <= 0 || finishedThisYear <= 0) return null;

  const years = unread / finishedThisYear;
  if (years < 0.75) return "At this year's pace, that's a few months of reading.";

  const rounded = Math.round(years * 2) / 2;
  const whole = Math.floor(rounded);
  const half = rounded - whole === 0.5;
  if (whole === 0) return "At this year's pace, that's about half a year of reading.";

  const word = whole <= 10 ? WORDS[whole] : whole.toLocaleString();
  const unit = rounded === 1 ? 'year' : 'years';
  return `At this year's pace, that's about ${word}${half ? ' and a half' : ''} ${unit} of reading.`;
}

// Initials for the borrower chip: one letter from each of the first two words of a name.
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
