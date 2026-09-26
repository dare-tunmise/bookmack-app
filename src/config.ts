// Set EXPO_PUBLIC_API_URL in .env.local (see .env.example). It's inlined at build time,
// so it must be referenced exactly as process.env.EXPO_PUBLIC_API_URL.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local and set it.');
}

export const API_BASE_URL = `${apiUrl.replace(/\/+$/, '')}/api/v1`;
