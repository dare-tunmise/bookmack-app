import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the app's config; this only adds build-specific settings on top of it.
//
// ALLOW_CLEARTEXT_HTTP=1 (set by the "preview" profile in eas.json) lets a test build reach a backend
// over plain http on the local network. Android release builds block cleartext traffic by default,
// and production builds should keep blocking it.
// What the bundle cannot start without.
//
// EXPO_PUBLIC_API_URL is inlined by the bundler at build time, and src/config.ts throws when it is
// absent — so a build with it unset produced an app that crashed on launch rather than a build
// that failed. That is what the production EAS environment held on 26 October 2026: nothing at
// all. Every build until then had been `preview`, where it is set, so nothing ever surfaced it.
//
// Expo evaluates this file for `expo start`, `expo export`, `expo prebuild` and every EAS build,
// after EAS has injected the profile's environment. Throwing here stops the build, with the fix
// in the message, instead of shipping the failure to a phone.
const apiUrlFault = (projectRoot: string): string | null => {
  // `expo export` reads this config *before* it loads the .env files, so without this the check
  // would fail a perfectly good local export. This is the loader Expo itself uses, and it is
  // idempotent — on EAS the variables are already real process env and nothing here changes them.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@expo/env') as { loadProjectEnv: (dir: string) => unknown }).loadProjectEnv(projectRoot);
  } catch {
    // Not fatal: if the loader moves, fall back to whatever is already in the environment, which
    // is all EAS ever had anyway.
  }

  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) return 'EXPO_PUBLIC_API_URL is not set';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `EXPO_PUBLIC_API_URL=${value} must be an absolute URL, e.g. https://api.bookmack.com`;
  }
  // Not "must be https": the preview profile talks to a laptop over http on purpose, which is why
  // that profile — and only that profile — sets ALLOW_CLEARTEXT_HTTP.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return `EXPO_PUBLIC_API_URL=${value} must be http or https`;
  }
  if (url.pathname !== '/') {
    return `EXPO_PUBLIC_API_URL=${value} must be the host only — src/config.ts adds /api/v1`;
  }
  return null;
};

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const fault = apiUrlFault(projectRoot);
  if (fault) {
    throw new Error(
      [
        `This build is missing configuration the app cannot start without:\n`,
        `  ${fault}\n`,
        `For an EAS build, set it on the profile's environment:`,
        `  npx eas-cli env:set --name EXPO_PUBLIC_API_URL --value https://api.bookmack.com \\`,
        `    --environment preview --environment production --visibility plaintext\n`,
        `Locally, copy .env.example to .env.local and set it there.`
      ].join('\n')
    );
  }

  if (process.env.ALLOW_CLEARTEXT_HTTP !== '1') {
    return config as ExpoConfig;
  }
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
  } as ExpoConfig;
};
