import type { Schemas } from '@/api/client';
import type { IconName } from '@/components/icon';

type Activity = Schemas['Activity'];

export type ActivityEntry = {
  icon: IconName;
  text: string;
  // Something went wrong, e.g. an email that didn't send.
  problem: boolean;
};

type Details = Record<string, unknown>;

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);
const nested = (value: unknown): Details => (value && typeof value === 'object' ? (value as Details) : {});
const quoted = (title: unknown) => `"${text(title, 'a book')}"`;

// Turns an activity log entry into a sentence. Returns null for internal entries (failed attempts,
// job bookkeeping) and anything unknown, which the activity screen skips. Action names and details
// come from the logActivity calls in the API's services/ and utils/cron.mjs (bookmack-api repo).
export function describeActivity({ action, details }: Activity): ActivityEntry | null {
  const d = details ?? {};

  switch (action) {
    case 'CREATE_BOOK':
      return { icon: 'plus', text: `Added ${quoted(d.title)}`, problem: false };
    case 'BATCH_ADD_BOOKS': {
      const count = typeof d.count === 'number' ? d.count : 0;
      return { icon: 'plus', text: `Added ${count} ${count === 1 ? 'book' : 'books'}`, problem: false };
    }
    case 'UPDATE_BOOK':
      return { icon: 'edit', text: `Edited ${quoted(d.title)}`, problem: false };
    case 'DELETE_BOOK':
      return { icon: 'trash', text: `Deleted ${quoted(d.title)}`, problem: false };
    case 'START_READING':
      return { icon: 'library', text: `Started reading ${quoted(d.title)}`, problem: false };
    case 'FINISH_READING':
      return { icon: 'check', text: `Finished ${quoted(d.title)}`, problem: false };
    case 'MARK_RATED_AS_READ': {
      const count = typeof d.count === 'number' ? d.count : 0;
      return {
        icon: 'check',
        text: `Marked ${count} rated ${count === 1 ? 'book' : 'books'} as read`,
        problem: false
      };
    }
    case 'BORROW_BOOK':
      return { icon: 'loans', text: `Lent ${quoted(d.title)} to ${text(d.borrowerName, 'a borrower')}`, problem: false };
    case 'RETURN_BOOK':
      return {
        icon: 'check',
        text: `${text(d.borrowerName, 'A borrower')} returned ${quoted(d.title)}`,
        problem: false
      };
    case 'SEND_REMINDER':
      return {
        icon: 'bell',
        text: `Reminded ${text(d.borrowerName, 'a borrower')} about ${quoted(d.title)}`,
        problem: false
      };
    case 'DUE_BOOK_REMINDER_SENT':
      return {
        icon: 'bell',
        text: `Automatic reminder sent to ${text(nested(d.borrower).name, 'a borrower')} about ${quoted(nested(d.book).title)}`,
        problem: false
      };
    case 'DUE_BOOK_REMINDER_FAILED':
      return {
        icon: 'error',
        text: `Couldn't send a reminder to ${text(nested(d.borrower).name, 'a borrower')} about ${quoted(nested(d.book).title)}`,
        problem: true
      };
    case 'CREATE_BORROWER':
      return { icon: 'users', text: `Added ${text(d.name, 'a borrower')} as a borrower`, problem: false };
    case 'UPDATE_BORROWER':
      return { icon: 'edit', text: `Updated ${text(d.name, 'a borrower')}'s details`, problem: false };
    case 'DELETE_BORROWER':
      return { icon: 'trash', text: `Removed ${text(d.name, 'a borrower')}`, problem: false };
    case 'BOOK_RECOMMENDED':
      return {
        icon: 'star',
        text: `Recommended ${quoted(nested(d.book).title)} to ${text(nested(d.recipient).name, 'a borrower')}`,
        problem: false
      };
    case 'RECOMMENDATION_EMAIL_FAILED':
      return {
        icon: 'error',
        text: `Couldn't email ${text(d.recipientName, 'a borrower')} your recommendation of ${quoted(d.bookTitle)}`,
        problem: true
      };
    default:
      return null;
  }
}
