import type { Schemas } from '@/api/client';
import type { ApiError, FieldTarget } from '@/api/errors';
import type { paths } from '@/api/schema';

// A BOOK_EXISTS error is about the ISBN when it names it, otherwise about the title (and author).
export const bookExistsField = (error: ApiError): FieldTarget<'title' | 'isbn'> => ({
  field: /isbn/i.test(error.message) ? 'isbn' : 'title'
});

export type NewBook = paths['/books']['post']['requestBody']['content']['application/json'];

type Candidate = Schemas['BookCandidate'];

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

// A POST /books body from a catalog match, trimmed to the API's field limits.
export function newBookFromCandidate(candidate: Candidate): NewBook {
  return {
    title: candidate.title.slice(0, 300),
    author: (candidate.authors.join(', ') || 'Unknown author').slice(0, 200),
    isbn: candidate.isbn13 ?? candidate.isbn10,
    category: clip(candidate.categories[0], 100),
    // The catalogs' subject headings: what "a book about Nigerian history" matches against.
    subjects: candidate.subjects,
    publisher: clip(candidate.publisher, 200),
    publishedDate: candidate.publishedDate,
    pageCount: candidate.pageCount,
    description: clip(candidate.description, 10000),
    language: clip(candidate.language, 10),
    thumbnail: candidate.thumbnail
  };
}
