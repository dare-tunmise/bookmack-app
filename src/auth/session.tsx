import * as Device from 'expo-device';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { toApiError } from '@/api/errors';
import { refreshTokens, tokens } from '@/auth/tokens';

type Profile = Schemas['Profile'];

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: Profile };

type SessionContextValue = SessionState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  // Replace the signed-in user's profile after an update (name, email, settings).
  updateUser: (user: Profile) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const SIGNED_OUT: SessionState = { status: 'signedOut', user: null };

// Shown in the account's session list, so users can tell their devices apart.
const currentDevice = () => ({
  name: (Device.deviceName ?? Device.modelName ?? 'Phone').slice(0, 100),
  platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'other'
} as const);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });

  const startSession = useCallback(async (session: Schemas['AuthSession']) => {
    await tokens.save(session);
    setState({ status: 'signedIn', user: session.user });
  }, []);

  // Restore the previous session on launch.
  useEffect(() => {
    const unsubscribe = tokens.onSignedOut(() => setState(SIGNED_OUT));

    (async () => {
      try {
        if ((await tokens.restore()) && (await refreshTokens())) {
          const { data, error } = await api.GET('/me');
          if (data) {
            setState({ status: 'signedIn', user: data.data });
            return;
          }
          throw toApiError(error);
        }
      } catch {
        // Fall through to signed out; saved tokens stay for the next launch unless the server rejected them.
      }
      setState(SIGNED_OUT);
    })();

    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await api.POST('/auth/login', { body: { email, password, device: currentDevice() } });
    if (!data) throw toApiError(error);
    await startSession(data.data);
  }, [startSession]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await api.POST('/auth/register', { body: { name, email, password, device: currentDevice() } });
    if (!data) throw toApiError(error);
    await startSession(data.data);
  }, [startSession]);

  const verifyEmail = useCallback(async (code: string) => {
    const { data, error } = await api.POST('/auth/verify-email', { body: { code } });
    if (!data) throw toApiError(error);
    setState({ status: 'signedIn', user: data.data });
  }, []);

  const resendVerification = useCallback(async () => {
    const { error } = await api.POST('/auth/verification/resend');
    if (error) throw toApiError(error);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.POST('/auth/logout');
    } catch {
      // Ending the session on the server is best-effort; the device forgets it either way.
    } finally {
      await tokens.clear();
      setState(SIGNED_OUT);
    }
  }, []);

  const updateUser = useCallback((user: Profile) => {
    setState((current) => (current.status === 'signedIn' ? { status: 'signedIn', user } : current));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signUp, verifyEmail, resendVerification, signOut, updateUser }),
    [state, signIn, signUp, verifyEmail, resendVerification, signOut, updateUser]
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
