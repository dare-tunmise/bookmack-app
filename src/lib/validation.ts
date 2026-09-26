// Shown for any email address that isn't valid, worded as in the input design.
export const INVALID_EMAIL_MESSAGE = 'Enter a valid email address';

// A quick check before sending; the API does the full validation.
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
