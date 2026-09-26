# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# BookMack mobile app

- Talks only to the API's `/api/v1`, through `src/api/client.ts`. Types come from the **live spec** at `https://api.bookmack.com/api/v1/openapi.json`: run `npm run api:types` here after the API changes. The API lives in its own repository now (`dare-tunmise/bookmack-api`), so there is no local path to generate from — and the types therefore describe what is actually deployed, not what is checked out.
- Auth: `src/auth/session.tsx` (`SessionProvider` / `useSession`) and `src/auth/tokens.ts` (refresh token in SecureStore, access token in memory, single-flight refresh). Don't call `/auth/refresh` anywhere else: concurrent refreshes with the same token end the session on the server.
- Routing: `src/app/_layout.tsx` picks screens with `Stack.Protected` from the session state; screens for signed-in, verified users live in `src/app/(app)/`. Screens don't navigate after sign-in, verification, or sign-out; the guards do.
- API errors: throw `toApiError(error)` from `src/api/errors.ts` and show `errorMessage(err)`.
- Config: `EXPO_PUBLIC_API_URL` in `.env.local` (see `.env.example`). Never put secrets in `EXPO_PUBLIC_` variables; they ship inside the app.
- UI: reuse `ThemedText` / `ThemedView`, `Button`, `TextField`, `FormScreen`, and the `Spacing` / `Brand` constants.
- Before committing: `npm run typecheck`.
