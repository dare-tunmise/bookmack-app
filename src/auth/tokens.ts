import * as SecureStore from 'expo-secure-store';

import type { components } from '@/api/schema';
import { API_BASE_URL } from '@/config';

type TokenPair = components['schemas']['TokenPair'];

// The refresh token survives restarts in SecureStore (Keychain / Android Keystore).
// The access token lives only in memory and is re-issued from the refresh token.
const REFRESH_TOKEN_KEY = 'bookmack.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const signedOutListeners = new Set<() => void>();

export const tokens = {
  accessToken: () => accessToken,

  // Loads the refresh token saved by a previous launch. Returns whether one exists.
  async restore(): Promise<boolean> {
    refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return refreshToken !== null;
  },

  async save(pair: Pick<TokenPair, 'accessToken' | 'refreshToken'>): Promise<void> {
    accessToken = pair.accessToken;
    refreshToken = pair.refreshToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, pair.refreshToken);
  },

  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  // Called when the server ends the session (refresh token rejected). Returns an unsubscribe.
  onSignedOut(listener: () => void): () => void {
    signedOutListeners.add(listener);
    return () => {
      signedOutListeners.delete(listener);
    };
  }
};

// Exchanges the refresh token for new tokens. Concurrent callers share one request: the
// backend treats reuse of an already-rotated refresh token as theft and ends the session.
// Resolves false on failure; network errors keep the tokens so a later attempt can succeed.
export function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const { data } = (await response.json()) as { data: TokenPair };
        await tokens.save(data);
        return true;
      }

      if (response.status === 401) {
        await tokens.clear();
        signedOutListeners.forEach((listener) => listener());
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
