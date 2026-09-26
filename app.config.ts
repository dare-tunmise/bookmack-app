import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the app's config; this only adds build-specific settings on top of it.
//
// ALLOW_CLEARTEXT_HTTP=1 (set by the "preview" profile in eas.json) lets a test build reach a backend
// over plain http on the local network. Android release builds block cleartext traffic by default,
// and production builds should keep blocking it.
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.ALLOW_CLEARTEXT_HTTP !== '1') {
    return config as ExpoConfig;
  }
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
  } as ExpoConfig;
};
