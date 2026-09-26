import type { components } from '@/api/schema';
import { API_BASE_URL } from '@/config';

type ErrorBody = components['schemas']['Error'];
type ValidationIssue = { path?: unknown; message?: unknown };

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// An error returned by the BookMack API, with its machine-readable code (e.g. EMAIL_TAKEN) and, for
// validation errors, the first message for each request field (e.g. { email: 'Invalid email address' }).
export class ApiError extends Error {
  code: string;
  fields: Record<string, string>;
  // The error's `details`, as sent by the API. PLAN_LIMIT_REACHED carries which limit was hit
  // ({ limitKey, limit, used, currentPlan }), which the plan limit sheet shows.
  details: unknown;

  constructor(message: string, code: string, fields: Record<string, string> = {}, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

// openapi-fetch returns the parsed error body; turn it into something screens can throw and show.
// For validation errors the first field message ("Invalid email address") beats "Invalid request".
export function toApiError(body: unknown): ApiError {
  const error = (body as ErrorBody | undefined)?.error;
  if (!error) {
    // Not a v1 error body (empty, HTML, or plain text), so the user only sees the generic message.
    if (__DEV__) console.warn('API returned an unexpected error body', body);
    return new ApiError(GENERIC_MESSAGE, 'UNKNOWN');
  }

  const issues = error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)
    ? (error.details as ValidationIssue[])
    : [];

  const fields: Record<string, string> = {};
  let firstMessage: string | undefined;
  for (const issue of issues) {
    if (typeof issue?.message !== 'string') continue;
    firstMessage ??= issue.message;
    if (typeof issue.path === 'string' && issue.path) {
      // "device.name" belongs to the "device" field.
      fields[issue.path.split('.')[0]] ??= issue.message;
    }
  }

  return new ApiError(firstMessage ?? error.message, error.code, fields, error.details ?? null);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  // fetch rejects with a TypeError when the server can't be reached. In development, name the
  // URL so a wrong EXPO_PUBLIC_API_URL is obvious.
  if (err instanceof TypeError) {
    if (__DEV__) {
      console.warn('API request failed', err);
      return `Request to ${API_BASE_URL} failed: ${err.message}`;
    }
    return "Can't reach BookMack. Check your connection and try again.";
  }
  if (__DEV__) console.warn('Unexpected error', err);
  return GENERIC_MESSAGE;
}

export type FieldTarget<F extends string> = { field: F; message?: string };
export type FieldTargetsByCode<F extends string> = Record<string, FieldTarget<F> | ((error: ApiError) => FieldTarget<F>)>;

// Splits an error into messages for specific form fields and, when no field fits, one message for
// the whole form. byCode sends API error codes to a field (e.g. EMAIL_TAKEN to email).
export function splitFormError<F extends string>(
  err: unknown,
  fields: readonly F[],
  byCode: FieldTargetsByCode<F> = {}
): { fieldErrors: Partial<Record<F, string>>; formError: string | null } {
  const fieldErrors: Partial<Record<F, string>> = {};

  if (err instanceof ApiError) {
    for (const field of fields) {
      if (err.fields[field]) fieldErrors[field] = err.fields[field];
    }
    const rule = byCode[err.code];
    const target = typeof rule === 'function' ? rule(err) : rule;
    if (target) fieldErrors[target.field] = target.message ?? err.message;
  }

  return { fieldErrors, formError: Object.keys(fieldErrors).length > 0 ? null : errorMessage(err) };
}
