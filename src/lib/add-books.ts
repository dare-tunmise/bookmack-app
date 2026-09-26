import { api } from '@/api/client';
import { ApiError, toApiError } from '@/api/errors';
import type { NewBook } from '@/lib/new-book';

// Matches MAX_BATCH_SIZE in the backend's services/books.mjs.
const MAX_BATCH_SIZE = 100;

export type AddProgress = { added: number; skipped: number };

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
};

// Adds several books, reporting progress as it goes so a caller can still show what was added when
// the account runs into its plan limit part-way through.
//
// The batch endpoint is a paid feature, so a free account falls back to adding one at a time.
// Either way, books already in the collection are skipped rather than treated as failures.
export async function addBooks(books: NewBook[], onProgress: (progress: AddProgress) => void): Promise<AddProgress> {
  const progress: AddProgress = { added: 0, skipped: 0 };
  let batchAllowed = true;

  for (const group of chunk(books, MAX_BATCH_SIZE)) {
    if (!batchAllowed) break;
    try {
      const { data, error } = await api.POST('/books/batch', { body: { books: group } });
      if (!data) throw toApiError(error);
      progress.added += data.data.created.length;
      progress.skipped += data.data.skipped;
      onProgress({ ...progress });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FEATURE_NOT_IN_PLAN') {
        batchAllowed = false;
        break;
      }
      throw err;
    }
  }

  if (batchAllowed) return progress;

  // One at a time, so a book already in the collection doesn't stop the rest.
  for (const book of books) {
    try {
      const { data, error } = await api.POST('/books', { body: book });
      if (!data) throw toApiError(error);
      progress.added += 1;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BOOK_EXISTS') {
        progress.skipped += 1;
      } else {
        throw err;
      }
    }
    onProgress({ ...progress });
  }

  return progress;
}
