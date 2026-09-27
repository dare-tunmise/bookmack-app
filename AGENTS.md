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

## Publishing

`eas update --channel preview --environment preview`. `EXPO_PUBLIC_API_URL` is baked in **at publish time from the EAS `preview` environment**, not from `.env.local` — change it with `eas env:set` and republish, or the bundle keeps the old address. Builds created without a channel never receive updates at all.

Order matters when the API changes: push `bookmack-api`, wait for Railway to deploy, *then* `npm run api:types` here. Regenerating before the deploy silently produces types for the old contract.

## Navigation: a drawer *and* a bottom bar, deliberately

The bar carries the handful of things worth a thumb — Library, Requests, a raised **+**, Read next, Stats — and the drawer carries everything else.

- It is a plain component, **not** a `Tabs` navigator: two of its five slots open **sheets** rather than routes, and a navigator wants every slot to be a screen.
- The bar floats over the screen; a spacer in `(drawer)/_layout.tsx` reserves its body in flow, so no screen has content hidden under it and only the button overhangs.
- The notch is an SVG path whose shoulder circles are tangent to both the top edge and the notch circle. That tangency is what makes the curve flow instead of kinking, and it cannot be done with rounded rectangles.
- **The overlay's bounds deliberately include the button's overhang.** Android does not deliver touches to a child outside its parent — rendering overflows fine, touches do not — so a button positioned above the bounds draws perfectly and then ignores taps on its top half.

## Icons

Drawn on a 24×24 grid in `src/components/icon.tsx`. System actions (close, search, check) use conventional shapes so they are recognised instantly; the things only BookMack has are built from the brand mark's geometry. `SOLID` holds filled variants for selected states and `filled` falls back to the outline where there is none — `wanted` has no solid twin **on purpose**, because solid icons are drawn with `stroke="none"` and a silhouette would erase the dashed edge that is the only thing distinguishing it from `library`.

Every icon is generated from one geometric definition: `npm run icons` (needs `rsvg-convert`). The website's favicons are staged in `dist/web-icons/` for copying into the website repo by hand.

## Reading

Reading has **its own sheet** (`components/reading-sheet.tsx`): the status control, the note you left last time, the page field, the progress bar, give up / read again, and the trail. It used to be all of that wedged into the details sheet between the rating and the loan card, which is how that sheet reached 764 lines. Reading is the part you return to; publisher and ISBN are read once.

What the details sheet keeps is a single row — state, progress bar, "Page 120 of 500" — that opens the sheet. **That row's bar follows what is saved; the sheet's own bar follows what is typed**, so it moves under your thumb as you enter a page. That immediate answer is the whole reason to bother typing one, and there is nothing to type on a row.

The reading sheet opens **over** the details sheet rather than replacing it, which is the same modal nesting the delete confirmation in there already relies on.

The library's **Reading tab** and the home "Currently reading" strip both ask the API for `readingStatus=reading,rereading` — a book being reread is being read. The strip is hidden on the Reading tab, since that tab is the same list in full.

Pace is deliberately narrow: it counts **only pages the reader reported**, and **only the current pass**. Finishing records the book's last page — a jump nobody sat and read — and counting it reported "about 324 pages a week" for someone who ticked a book off a week after starting it. A re-read starts again from zero, so entries before a restart describe a different journey.

## Known issues

- [ ] **Premium can't be bought yet.** The server half shipped 26 Sep 2026 (`POST /billing/play/purchase`, the RTDN webhook, verification against Google, all in `bookmack-api`). Missing here is the purchase flow, which needs a **native billing module** — so it ships by `eas build`, not `eas update`, and cannot be exercised until the app is on a Play track. Every surface still says "coming soon".
  - Blocked on a Google Play Console account. A new personal account must run a closed test with **12 testers opted in continuously for 14 days** before it can apply for production access, and review then takes about a week — roughly three weeks that no code shortens.
  - When the purchase flow lands it must handle `400 MANAGED_BY_GOOGLE_PLAY` from `POST /billing/cancel` by sending the user to the Play Store, not showing it as an error: Google requires Play subscriptions to be cancelled there.
- [x] **Re-reads don't appear in the home "Currently reading" strip.** Fixed 27 Sep 2026. `GET /books?readingStatus=` now takes a comma-separated list, so the strip and the Reading tab both ask for `reading,rereading`. The `UNREAD` handling that made this awkward is described in `bookmack-api`'s CLAUDE.md: `unread` has to match books with no `readingStatus` field at all, and that `null` must not leak into any other filter.
- [ ] No automated tests. `npm run typecheck` is the only gate, so the scanner and purchase flows are unverified except by hand.
