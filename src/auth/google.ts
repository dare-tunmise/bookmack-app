import { GoogleSignin, statusCodes, type NativeModuleError } from '@react-native-google-signin/google-signin';

// Sign in with Google: the client half.
//
// The server takes an ID token at POST /api/v1/auth/google and returns the same AuthSession as a
// password login, creating or linking an account by Google's verified email. This file is the only
// place that talks to Google; the screens hand what comes back to `signInWithGoogle` on the
// session and never see a Google type.
//
// The token's `aud` is the WEB client ID, not the Android one, because the native library asks for
// the ID token on behalf of the web client. That is what the server accepts, and it is why the
// Android client ID never appears here — its only job is to exist in the Google console beside the
// app's package name and signing fingerprint, so Google agrees to talk to this build at all.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Inlined at build time, like EXPO_PUBLIC_API_URL. A build made without it cannot sign in with
// Google, so the button says so rather than throwing: unlike the API URL, the app is perfectly
// usable without this, and failing the whole build over it would be the wrong trade.
export const GOOGLE_SIGN_IN_AVAILABLE = Boolean(webClientId);

export const GOOGLE_SIGN_IN_UNAVAILABLE = 'Signing in with Google is not available in this build.';

let configured = false;

// Configuration is synchronous and cheap, but it must happen before the first `signIn`, and doing
// it at module scope would run it during a web prerender where the native module is absent.
const configure = () => {
  if (configured) return;
  GoogleSignin.configure({ webClientId, scopes: ['openid', 'email', 'profile'] });
  configured = true;
};

const isNativeModuleError = (err: unknown): err is NativeModuleError =>
  err instanceof Error && typeof (err as NativeModuleError).code === 'string';

// Returns Google's ID token for the account the person picks, or **null if they backed out**.
//
// Cancelling is not an error. It arrives here two different ways — a `cancelled` response and a
// SIGN_IN_CANCELLED rejection, depending on platform and on which sheet was dismissed — and both
// have to end as null, or dismissing the Google sheet leaves an error on a screen the person was
// only looking at.
export async function requestGoogleIdToken(): Promise<string | null> {
  if (!webClientId) throw new Error(GOOGLE_SIGN_IN_UNAVAILABLE);

  configure();

  try {
    // Without Play Services there is no account picker at all. Asking first turns a bare rejection
    // into Google's own "update Play Services" dialog, which is the only thing that can fix it.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;

    const { idToken } = response.data;
    // Documented as nullable. It should never be null with a webClientId set, so if it is, say
    // something true rather than posting `null` to the server and reading back a 400.
    if (!idToken) throw new Error('Google did not return a sign-in token. Please try again.');
    return idToken;
  } catch (err) {
    if (!isNativeModuleError(err)) throw err;

    switch (err.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return null;
      case statusCodes.IN_PROGRESS:
        // A second tap while Google's sheet is already up. Nothing to report: the first attempt is
        // still running and will resolve the screen either way.
        return null;
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        throw new Error('Google Play Services is needed to sign in with Google.');
      case 'DEVELOPER_ERROR':
      case '10':
        // Android's answer when this build's package name and signing fingerprint are not on an
        // OAuth client in the Google console. It carries no useful message of its own, and it is
        // the failure that appears only for installs signed with a different key — which is to
        // say, every Play install, if Play's app-signing SHA-1 was never registered.
        throw new Error('Google sign-in is not set up for this build of the app.');
      default:
        throw new Error('Google sign-in failed. Please try again.');
    }
  }
}
