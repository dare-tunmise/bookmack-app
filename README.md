# BookMack mobile app

The BookMack Android app, built with [Expo](https://expo.dev) (React Native, Expo Router, TypeScript). It talks to the API at **https://api.bookmack.com**, whose source lives in the `bookmack-api` repository.

## Run it on your phone

1. **Point the app at an API.** Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`.
   For everyday work that is just the hosted one:

   ```
   EXPO_PUBLIC_API_URL=https://api.bookmack.com
   ```

   To work against a local copy instead, run `npm run dev` in the `bookmack-api` repo and use your
   computer's LAN IP — `localhost` on a phone means the phone itself:
   - macOS: `ipconfig getifaddr en0`, then `http://<that ip>:5000`.
   - The phone and computer must be on the same Wi-Fi, and the address changes when the network does.
   - Check it with `curl http://<ip>:5000/api/v1/openapi.json`, which should return JSON.

2. **Install and start:**

   ```bash
   npm install
   npm start
   ```

3. **Open it:** install **Expo Go** from the Play Store, then scan the QR code shown in the terminal.
   Saving a file reloads the app on the phone.

Restart `npm start` after changing `.env.local`: `EXPO_PUBLIC_` values are built into the bundle.

## After API changes

The API client is typed from the **live** OpenAPI spec at `https://api.bookmack.com/api/v1/openapi.json`,
so the types describe what is actually deployed rather than whatever happens to be checked out
somewhere else. Regenerate them, then fix anything `npm run typecheck` reports:

```bash
npm run api:types
```

Order matters: change the API, push it, wait for Railway to deploy, *then* regenerate here.
Running this before the deploy silently produces types for the old contract.

## Layout

| Path | What's there |
|---|---|
| `src/app/` | Screens (file-based routes). `_layout.tsx` chooses screens from the session state. |
| `src/app/(app)/` | Screens for signed-in, verified users: add-book screens pushed over the drawer |
| `src/app/(app)/(drawer)/` | Side-menu sections; `index.tsx` is the library bookshelf (Recent / My Books / Lent out) |
| `src/auth/` | Session context (`useSession`) and token storage/refresh |
| `src/api/` | Typed API client, generated `schema.d.ts`, error helpers |
| `src/components/` | Shared UI (themed text/views, form fields, buttons, book covers) |
| `src/lib/` | Plain helpers (barcode ISBN parsing, catalog match → new book) |

## Adding books

The **+** button → **Scan a book** opens the camera (`src/app/(app)/scan.tsx`):

- **Barcode** (free): a book barcode (ISBN-13, starting 978/979) opens `add-book` with `?isbn=`,
  which looks it up and adds it.
- **Cover photo** (for books without a barcode): the shutter takes a photo and opens `cover-scan`,
  which shrinks it to 1568px on the long edge (`src/lib/cover-photo.ts`), uploads it from memory
  to `POST /lookup/cover`, and lists the catalog matches. Each scan counts toward the plan's monthly
  limit (5 on Free, 100 on Premium), and the backend needs `ANTHROPIC_API_KEY`. Barcode lookups are
  free and unlimited on both plans.

From the scanner you can also **Search by title** (`search`) or **Type it in** (`book-form`).
Camera scanning works in Expo Go; it isn't available in the web preview.

## Editing and lending

Tapping a book on the shelf opens its details sheet (`src/components/book-details-sheet.tsx`):

- **Edit** opens `edit-book?id=`. Status can be set to Available or Lost; Loaned is only set by
  lending and cleared by returning.
- **Delete** asks for confirmation. It's disabled while the book is on loan, because deleting it
  would leave the loan pointing at a missing book.
- **Lend this book** opens `lend?bookId=`: pick or add a borrower and a due date (end of that day).
  The backend emails the borrower a confirmation.
- A book on loan shows its loan (`src/components/loan-card.tsx`) with **Mark returned** and
  **Send reminder**.

**Loans** in the side menu (`src/app/(app)/(drawer)/loans.tsx`) lists loans by Lent out (includes
overdue), Overdue, and Returned.

## App icon, splash, and favicons

Every icon comes from one geometric definition of the logo in `scripts/generate-icons.mjs`. It writes
the master SVGs to `assets/brand/` and renders:

- `assets/images/icon.png`: the full app icon (1024px square; stores and launchers round the corners).
- `assets/images/android-icon-foreground.png` and `android-icon-monochrome.png`: Android adaptive
  icon layers, scaled to stay inside the safe zone. The background layer is the lime color in `app.json`.
- `assets/images/splash-icon.png`: the mark shown on the lime splash screen.
- `assets/images/favicon.png` (Expo web), and the website's icons — `favicon.svg`, `favicon-48.png`,
  `bookmack-icon.svg` and `apple-touch-icon.png` — staged in `dist/web-icons/`. Copy those into the
  website repo by hand when the mark changes; the script no longer writes across repositories, and
  `dist/` is gitignored so they are never committed here.

To change the logo, edit the geometry in the script and run `npm run icons` (needs `rsvg-convert`:
`brew install librsvg`). The app icon and splash screen only show in a real build (EAS preview or
production), not in Expo Go.

## Checks

```bash
npm run typecheck
```
