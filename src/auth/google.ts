// Sign in with Google: the two ends exist, the middle does not yet.
//
// The server end is built — POST /api/v1/auth/google takes a Google ID token and returns the same
// AuthSession as a password login — and the button is drawn on both auth screens. What is missing
// is the step between them: asking Google for an ID token needs a native module and an OAuth
// client ID per platform, and neither is in this build.
//
// The button is shown and says so rather than being hidden, because it is the first thing people
// look for on a sign-in screen, and a screen that offers nothing but a password field reads as an
// app that has not been updated in years. When the native module lands, only this file changes:
// the screens already have everywhere else they need.
export const GOOGLE_SIGN_IN_AVAILABLE = false;

export const GOOGLE_SIGN_IN_UNAVAILABLE = 'Signing in with Google arrives in the next update.';

// Returns Google's ID token for the account the person picks. The screens hand it straight to the
// session, which posts it to /api/v1/auth/google.
export async function requestGoogleIdToken(): Promise<string> {
  throw new Error(GOOGLE_SIGN_IN_UNAVAILABLE);
}
