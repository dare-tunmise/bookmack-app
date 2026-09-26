import createClient from 'openapi-fetch';

import type { components, paths } from '@/api/schema';
import { refreshTokens, tokens } from '@/auth/tokens';
import { API_BASE_URL } from '@/config';

export type Schemas = components['schemas'];

const withAccessToken = (request: Request): Request => {
  const token = tokens.accessToken();
  if (token) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
};

const isExpiredAccessToken = async (response: Response): Promise<boolean> => {
  if (response.status !== 401) return false;
  const body = (await response.clone().json().catch(() => null)) as Schemas['Error'] | null;
  return body?.error?.code === 'TOKEN_EXPIRED';
};

// Adds the access token; if it has expired, refreshes once and retries the request.
const authFetch = async (request: Request): Promise<Response> => {
  const retry = request.clone();
  const response = await fetch(withAccessToken(request));

  if (!(await isExpiredAccessToken(response)) || !(await refreshTokens())) return response;
  return fetch(withAccessToken(retry));
};

// Typed client for the BookMack v1 API. Paths, parameters, bodies, and responses come from
// the backend's OpenAPI spec; regenerate with `npm run api:types` after backend changes.
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: authFetch });
