# BookMack mobile app

The BookMack Android app, built with [Expo](https://expo.dev) (React Native, Expo Router, TypeScript). It talks to the backend's `/api/v1`.

## Run it on your phone

1. **Start the backend** with its `.env` set up:

   ```bash
   cd ../backend && npm run dev
   ```

2. **Point the app at it.** Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`
   to `http://<your computer's LAN IP>:<backend PORT>`:
   - On a phone, `localhost` means the phone itself, so use your computer's LAN IP
     (on macOS: `ipconfig getifaddr en0`).
   - Use the `PORT` from `backend/.env` (5000 if it isn't set).
   - The phone and computer must be on the same Wi-Fi.

   Quick check from your computer: `curl http://<ip>:<port>/api/v1/openapi.json` should return JSON.

3. **Install and start:**

   ```bash
   npm install
   npm start
   ```

4. **Open it:** install **Expo Go** from the Play Store, then scan the QR code shown in the terminal.
   Saving a file reloads the app on the phone.

Restart `npm start` after changing `.env.local`: `EXPO_PUBLIC_` values are built into the bundle.

## After backend API changes

The API client is typed from the backend's OpenAPI spec. Regenerate the types, then fix anything
`npm run typecheck` reports:

```bash
cd ../backend && npm run export:openapi
cd ../mobile && npm run api:types
```

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
- `assets/images/favicon.png` (Expo web) and, in `../frontend/public/`, `favicon.svg`,
  `favicon-48.png`, and `apple-touch-icon.png` for the web app.

To change the logo, edit the geometry in the script and run `npm run icons` (needs `rsvg-convert`:
`brew install librsvg`). The app icon and splash screen only show in a real build (EAS preview or
production), not in Expo Go.

## Checks

```bash
npm run typecheck
```
