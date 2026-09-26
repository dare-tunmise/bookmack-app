# BookMack Android app: UI design brief

You are designing the complete UI for **BookMack**, an Android app for managing a personal library and lending books to friends. Produce a clean, modern, high-fidelity design for every screen and state listed below, using the design system in this brief exactly.

---

## 1. What to produce

Work in this order, one section at a time. Finish a section, show it, then continue.

1. **Design system sheet**:
   - color tokens, type scale, spacing, radii and elevation;
   - every component in §7, in all its states.
2. **Screens**, grouped as in §8, starting with **Onboarding & authentication**.
3. **Design tokens as JSON** at the end (colors, typography, spacing, radii, shadows), so the app can use them directly.

**Format**
- **File:** one self-contained HTML file per section (inline CSS, no build step). Fonts come from Google Fonts.
- **Phone frames:** draw each screen in a frame of **412 × 915 px** (a typical Android phone). Put them side by side on a light gray canvas.
- **Labels:** label every frame with its screen number and name (e.g. `3.4 Cover scan – matches`).
- **States:** when a screen has several states (loading, empty, error…), draw each as its own frame.
- **Annotations:** under each frame, add 2–4 lines on anything non-obvious, such as which action opens which screen or what is tappable.
- **Content:** use the realistic sample content in §10, never lorem ipsum.
- **Assumptions:** don't add features that aren't listed. If something is unclear, make a sensible choice and note it under the frame.

---

## 2. The product

BookMack helps people who own a lot of books keep track of them and lend them out without losing them.

- **Add books fast.** Scan the barcode, **snap a photo of the cover** (AI reads the title and finds the book), search by title, or type it in.
- **See your library as a bookshelf.** Covers stand on shelves; tap one for details.
- **Lend and get books back.** Pick a borrower and a due date. BookMack emails the borrower a confirmation, and you can send reminders. Overdue books stand out.
- **Plans.** Free, Basic, Premium, with monthly limits (§9).

**Personality:** calm, confident, friendly and organized. Think "a well-kept personal library", modern rather than old-fashioned: no wood grain, no leather, no paper textures.

---

## 3. Platform constraints (must follow)

- **Platform:** Android first, built with **React Native (Expo)**. Everything you design must be buildable with standard React Native views, SVG and images. No hover states, no CSS-only effects that have no native equivalent, no heavy blur.
- **Layout:** portrait only. Design at 412 px wide, and the layout must also work at 360 px.
- **Safe areas:** respect the status bar at the top and the gesture/navigation bar at the bottom.
- **Touch targets:** at least **48 × 48 px**.
- **Navigation:**
  - The main areas live in a **side drawer** (☰ in the top app bar).
  - Detail views and pickers are **bottom sheets** that slide up.
  - Forms and flows are **full screens with a back arrow**.
  - The Android back button closes sheets and goes back.
- **Theme:** light theme only for this pass.
- **Accessibility:**
  - Text contrast at least WCAG AA (4.5:1 for body text, 3:1 for large text and icons).
  - Never rely on color alone: overdue items also say "Overdue".
  - Layouts must survive larger system font sizes, so avoid fixed-height text boxes.

---

## 4. Color

Use these tokens. **Given** colors are required and exact. **Derived** colors fill the gaps; keep them unless they clearly clash.

| Token | Hex | Source | Use |
|---|---|---|---|
| `background` | `#F6F7F4` | Given | App background on every screen |
| `brand` | `#347821` | Given | Links, active tab indicator, selected states, icons, focus rings |
| `brandTint` | `#EEF7E8` | Given | Secondary buttons, chips, highlighted cards, selected list rows, icon circles |
| `accent` | `#9FE870` | Given | Highlights only: badges, progress and usage meters, illustration fills, small decorative shapes |
| `buttonPrimary` | `#163300` | Given | Primary button background (one per screen) |
| `buttonSecondary` | `#EEF7E8` | Given | Secondary button background |
| `surface` | `#FFFFFF` | Derived | Cards, bottom sheets, inputs, drawer |
| `textPrimary` | `#163300` | Derived (reuses given) | Headings and main text |
| `textBody` | `#1F2A1B` | Derived | Long body text (descriptions) |
| `textSecondary` | `#5E6B58` | Derived | Hints, metadata, captions |
| `border` | `#E2E6DE` | Derived | Input borders, dividers, card outlines |
| `danger` | `#B3261E` | Derived | Delete buttons, overdue text, errors |
| `dangerTint` | `#FCEBE8` | Derived | Error banners, overdue badge background |

**Pairings and contrast** (already checked; use these combinations):

| Combination | Contrast | Status |
|---|---|---|
| Primary button: `#FFFFFF` label on `#163300` | about 15:1 | Pass |
| Primary button: `#9FE870` label on `#163300` (alternative for special CTAs, e.g. "Snap the cover") | about 9.4:1 | Pass |
| Secondary button: `#163300` label on `#EEF7E8` | about 12.7:1 | Pass |
| `#347821` text on `#F6F7F4` or on white | about 5:1 | Pass (normal text) |
| `#5E6B58` secondary text on `#F6F7F4` | about 5.3:1 | Pass |
| White text on `#B3261E` | about 6.5:1 | Pass |
| `#9FE870` text on a light background | about 1.3:1 | **Never** |

**Rules**
- Lime `#9FE870` is decoration and highlight only on light backgrounds. It can be a fill behind dark text (`#163300` on `#9FE870` is about 9.4:1).
- At most **one primary (dark green) button** per screen. Everything else is secondary (`#EEF7E8`) or a text link in `brand`.
- **Status colors:**

  | Status | Treatment |
  |---|---|
  | Available | `brandTint` background, `brand` text |
  | On loan | `accent` background, `textPrimary` text |
  | Overdue | `dangerTint` background, `danger` text |
  | Lost | `border` background, `textSecondary` text |
  | Returned | `surface` with `border` outline, `textSecondary` text |

---

## 5. Typography

The type must feel **confident and bold**, not generic. Don't use Inter, Roboto, SF, Arial or the system font.

- **Headings and display:** **Bricolage Grotesque** (Google Fonts), weights 700–800. Tight letter-spacing on large sizes.
- **UI and body:** **Plus Jakarta Sans** (Google Fonts), weights 500, 600, 700.

| Style | Font | Size / line height | Weight | Letter-spacing | Use |
|---|---|---|---|---|---|
| Display | Bricolage Grotesque | 36 / 40 | 800 | -0.5 | Welcome and auth hero titles |
| H1 | Bricolage Grotesque | 28 / 34 | 800 | -0.3 | Screen titles |
| H2 | Bricolage Grotesque | 22 / 28 | 700 | -0.2 | Sheet titles, book titles in details |
| H3 | Plus Jakarta Sans | 18 / 24 | 700 | 0 | Section headings, card titles |
| Body | Plus Jakarta Sans | 16 / 24 | 500 | 0 | Default text, inputs |
| Body small | Plus Jakarta Sans | 14 / 20 | 500 | 0 | Metadata, list secondary lines |
| Label | Plus Jakarta Sans | 14 / 20 | 700 | 0.1 | Field labels, tabs, chips |
| Button | Plus Jakarta Sans | 16 / 20 | 700 | 0.1 | All buttons |
| Caption | Plus Jakarta Sans | 12 / 16 | 600 | 0.2 | Badges, timestamps |

Use sentence case everywhere ("Lend this book", not "Lend This Book"). Tabs use sentence case too, not all caps.

---

## 6. Shape, spacing, elevation, imagery

### Shape and spacing
- **Spacing scale** (4 px grid): 4, 8, 12, 16, 24, 32, 48. Screen side padding is 20.
- **Radii:**

  | Element | Radius |
  |---|---|
  | Buttons and chips | Fully rounded pill (999) |
  | Inputs | 14 |
  | Cards | 20 |
  | Bottom sheets | 28 (top corners) |
  | Book covers | 6 |
  | Avatars | Circle |

- **Buttons:** 52 px tall, full width in forms.
- **Inputs:** 52 px tall, `surface` fill, 1 px `border`. Focus uses a 2 px `brand` border.

### Elevation
Mostly flat: separate things with color and 1 px borders, not shadows. Use soft shadows only for:
- **Bottom sheets:** `0 -8 24 rgba(22, 51, 0, 0.08)`.
- **Book covers:** `0 4 10 rgba(22, 51, 0, 0.18)`, so covers look like objects standing on the shelf.
- **Floating add button:** `0 6 16 rgba(22, 51, 0, 0.24)`.

### Icons
Rounded, 2 px stroke line icons, e.g. Material Symbols Rounded, 24 px, in `textPrimary` or `brand`.

### Illustrations and avatars: DiceBear
Use **DiceBear** (dicebear.com) for people and friendly 2D/3D-looking imagery.

- **URL format:** `https://api.dicebear.com/10.x/<style>/<format>?seed=<text>&backgroundColor=<hex without #>`.
- **Formats:**
  - Use **PNG** for anything shown in the app. It's limited to 256 × 256 px, so display it at 256 px or smaller.
  - Use **SVG** only for large hero art.
- **Same seed, same image:** seed people by email or name, so the same borrower always gets the same avatar.

**Styles to use**

| Purpose | Style | License |
|---|---|---|
| **People (2D):** user and borrower avatars, auth heroes, empty states | `notionists` (preferred) or `lorelei` | CC0 remixes; credit recommended (Zoish / Lisa Wischofsky) |
| **3D-looking abstract art:** onboarding, plan cards, success states | `glass`, `clay` or `shapes` (preview on dicebear.com and pick one) | CC0, no credit required |

- **Avoid the CC BY styles** (`adventurer`, `avataaars`, `micah`, `big-smile`, etc.) unless the About screen credits them.
- **Backgrounds:** set `backgroundColor` to palette colors: `eef7e8`, `9fe870` or `f6f7f4`.

**Examples**
- Borrower avatar: `https://api.dicebear.com/10.x/notionists/png?seed=chidi.obi@example.com&backgroundColor=eef7e8`
- User avatar: `https://api.dicebear.com/10.x/notionists/png?seed=Adaeze%20Okafor&backgroundColor=9fe870`
- Abstract hero: `https://api.dicebear.com/10.x/glass/svg?seed=bookmack-welcome`

**Where imagery goes**
- Auth and onboarding heroes.
- Empty states: empty library, no loans, no borrowers, nothing overdue.
- Profile and drawer header.
- Borrower rows.
- Success confirmations: book added, loan created.

Don't put illustrations on dense screens such as the shelf, forms or lists.

**Production note, for annotations only:** the public DiceBear API is rate limited, and DiceBear recommends self-hosting for commercial use. The build will cache or self-host, so the design can assume images load.

### Subtle vector background
On **welcome, auth, verification, success and empty-state** screens only:
- **Motifs:** a quiet line-art pattern of open books, bookmarks, small leaves and sparkles.
- **Style:** drawn in `brand` `#347821` at **5–7% opacity**, 1.5 px strokes, plus 2–3 soft organic blobs in `brandTint` / `accent` at 30–40% opacity near the top.
- **Placement:** keep it away from text and inputs, since content sits on `background` or `surface` areas.
- **Format:** it must be a single SVG that scales, not a photo.

Never use a pattern behind the bookshelf, lists or forms.

---

## 7. Components (design every state)

- **Top app bar:**
  - ☰ drawer button, screen title (H1 left-aligned or H3 centered; pick one and stay consistent), right actions (search).
  - Variant with a back arrow.
  - Search mode: the input replaces the title, with a close ×.
- **Side drawer:**
  - Header: avatar, name, email, plan badge.
  - Items: Library, Loans, Borrowers, Stats, Activity, Account & settings, Plan & limits.
  - Footer: Sign out, app version.
  - Active item highlighted in `brandTint`.
- **Tabs:** 2–3 equal tabs with a 3 px `brand` underline on the active one.
- **Buttons:**
  - Variants: primary, secondary, danger, text link, icon button.
  - States: default, pressed, disabled, loading (spinner replaces the label).
- **Text field:**
  - Label above, input, hint below.
  - States: default, focused, error (message in `danger`), disabled.
  - Password field has a show/hide toggle.
- **Code input:** 6 separate digit boxes, auto-advancing, with error state.
- **Password rules checklist:** 8+ characters, uppercase, lowercase, number, special character. Each item ticks green as it's met.
- **Chips / segmented choices:** due date presets ("1 week", "2 weeks", "1 month"); status choice (Available / Lost).
- **Book cover:**
  - Image version.
  - Placeholder version for books without a cover: a typographic cover in a palette color with the title in Bricolage Grotesque. Rotate through `#163300` with lime text, `#347821` with white text, and `#EEF7E8` with dark text.
- **Bookshelf row:**
  - 3 covers (4 on wider phones) standing on a flat **shelf ledge**: a 10 px rounded bar in `brandTint` with a thin `border` line beneath.
  - No wood. Don't imitate the look of any existing reading app.
- **List rows:** catalog match (cover, title, author · year); borrower (avatar, name, email, "2 books out"); loan (cover, title, borrower, due text).
- **Loan card:** "Lent to …", email, due status ("Due tomorrow" / "Overdue by 3 days" in danger), "lent 12 Sep 2026", **Mark returned** (primary) and **Send reminder** (secondary).
- **Status badge:** Available, On loan, Overdue, Lost, Returned (colors in §4).
- **Bottom sheet:** handle, optional title, content, safe-area padding. Also a variant with a list of options (the add-book menu).
- **Dialog:** confirm destructive actions (title, one line of text, Cancel + red action).
- **Floating add button:** 60 px circle in `buttonPrimary` with a lime `+`, bottom right.
- **Snackbar / toast:** short confirmations ("Reminder sent to Chidi").
- **Banners:** plan limit reached (with upgrade link), offline / can't reach BookMack, info.
- **Usage meter:** label, "3 of 5 this month", lime progress bar on `brandTint`; turns `danger` when full.
- **Stat card:** big number (Bricolage Grotesque 32), label, optional trend.
- **Skeleton loaders:** shelf rows, list rows, details sheet.
- **Empty state:** DiceBear illustration, H3 title, one line of help, one button.
- **Camera overlay:**
  - Dark translucent edges with a clear rounded frame for the barcode.
  - Hint text, and a large round **shutter** labelled "Snap the cover".
  - Secondary buttons "Search by title" and "Type it in".

---

## 8. Screens

**Legend:** **[Built]** means the screen exists today and needs a redesign that keeps its behavior. **[New]** means it isn't built yet.

### 8.1 Onboarding & authentication (start here)

**1.1 Splash [Built]**
- BookMack wordmark centered on `background`. A small lime accent shape is optional.

**1.2 Welcome [New]**
- Vector background pattern, a DiceBear hero, Display title "Your books, always within reach".
- Three short value points with icons:
  - "Scan a barcode or snap the cover"
  - "Lend books and know who has them"
  - "Friendly reminders when they're due"
- Buttons: **Create account** (primary), **Log in** (secondary).

**1.3 Sign up [Built]**
- Fields: Name, Email, Password with the live rules checklist.
- **Create account** (primary). "Already have an account? Log in".
- Small print: "By continuing you agree to the Terms and Privacy Policy" (links).
- States:
  - default;
  - typing, with the checklist partly met;
  - error from the server (e.g. "An account with this email already exists");
  - loading.

**1.4 Log in [Built]**
- Email, Password, "Forgot password?" link, **Log in** (primary), "New here? Create an account".
- States: default; wrong email or password (error banner); can't reach BookMack (offline banner); loading.

**1.5 Verify your email [Built]**
- Illustration, "Check your email", "We sent a 6-digit code to ada@example.com".
- 6-digit code input, **Verify** (primary), "Resend code" (text link; after tapping, show "Code sent" and a 60 s countdown), "Use a different account" (signs out).
- States: default, wrong code, resent confirmation.

**1.6 Forgot password [New]**
- Email field, **Send reset link** (primary).

**1.7 Check your email [New]**
- Illustration, "If an account exists for ada@example.com, we've sent a link to reset your password. It expires in 1 hour.", **Back to log in**.

**1.8 Set a new password [New]**
- Opened from the email link.
- New password field with the rules checklist, **Save password** (primary).
- States: default; link expired or invalid ("This link has expired. Request a new one." with a button).

### 8.2 Library

**2.1 Library – bookshelf [Built]**
- App bar: ☰, "Library", search icon.
- Tabs: **Recent · My books · Lent out**.
- Shelves: rows of covers on ledges. A small "On loan" badge sits at the top corner of covers that are out.
- Floating add button.
- States:
  - loading (skeleton shelves);
  - full shelves;
  - empty library (illustration, "Your library is empty", "Scan a barcode or snap a cover to add your first book", **Add a book**);
  - Lent out tab empty ("Nothing is lent out");
  - error with Try again.

**2.2 Library – search [Built]**
- Search input in the app bar, results as shelves.
- States: typing, results, no matches ("No books match 'dune'").

**2.3 Side drawer [Built]**
- As in §7.

**2.4 Book details sheet [Built]**
- Large cover, H2 title, author, rating stars (if any), tag chips.
- Facts card: Status, Category, Publisher, Published, Pages, ISBN, Language, Added.
- "About this book" description, collapsible after 4 lines.
- Actions depend on state. Draw each as its own frame:
  - **Available:** **Lend this book** (primary); Edit (secondary) and Delete (danger text button).
  - **On loan:** loan card (Mark returned, Send reminder); Edit; Delete disabled with "Mark it returned before deleting".
  - **Overdue:** same as On loan, with the overdue treatment.
  - **Lost:** "Marked as lost" badge; Lend disabled with the hint "Edit the book to mark it available"; Edit; Delete.

**2.5 Delete book dialog [Built]**
- "Delete this book?", "'Americanah' will be removed from your library.", Cancel / **Delete**.

### 8.3 Adding books

**3.1 Add a book sheet [Built]**
- Title "Add a book". Three large option rows, each with an icon in a `brandTint` circle:
  - **Scan a book**: "Scan the barcode on the back, or snap a photo of the front cover."
  - **Search by title**: "Find it by title, author, or ISBN."
  - **Type it in**: "Enter the title and author yourself."
- Cancel.

**3.2 Camera permission [Built]**
- Illustration, "Camera access", "BookMack uses your camera to read a book's barcode or cover."
- **Allow camera access** (primary). Denied variant: **Open settings**.
- Secondary links: "Search by title" / "Type it in".

**3.3 Scanner [Built]**
- Full-screen camera (use a blurred bookshelf photo as a stand-in), barcode frame.
- Hint "Point at the barcode on the back. No barcode? Snap the front cover."
- Shutter "Snap the cover", buttons "Search by title" and "Type it in".
- States: default; not an ISBN barcode ("That barcode isn't a book's ISBN…"); capturing (shutter shows a spinner).

**3.4 Cover scan [Built]**
- Your photo as a small cover at the top.
- States:
  - **Reading:** photo, spinner, "Reading the cover…".
  - **Matches:** "Is it one of these?", "Read from the cover: 'Things Fall Apart' by Chinua Achebe", list of catalog matches, then **None of these: type it in** (secondary) and **Take another photo** (text).
  - **No match:** "We couldn't find this book", what was read, **Type it in** (primary, pre-filled), **Take another photo**.
  - **Not a book cover:** message + **Take another photo**.
  - **Monthly scan limit reached:** "Your Free plan allows 5 cover scans a month." with a usage meter at 5/5 and **See plans** + **Search by title**.
  - **Scanning unavailable:** "Cover scanning is temporarily unavailable. Add the book by ISBN or search instead."

**3.5 Book found [Built]**
- Opened after a barcode scan or when a match is picked.
- Large cover, title, subtitle, authors, "Publisher · 2009 · 309 pages", ISBN.
- **Add to library** (primary), **Not this book** (secondary).
- States:
  - looking up ("Looking up ISBN 9780385474542…");
  - found;
  - not in the catalogs ("ISBN … isn't in the book catalogs yet", **Type it in**, **Scan again**);
  - already in your library (409: "This book is already in your library");
  - book limit reached (Free: 50 books) with **See plans**.

**3.6 Search the catalog [Built]**
- Search field, **Search** button, results list of catalog matches.
- States: empty (hint text), searching, results, no matches (+ **Type it in**), catalog unavailable.

**3.7 Type it in [Built]**
- Title, Author, ISBN (optional, hint "The 10 or 13 digit number above the barcode"), **Add to library**.
- Pre-filled variant (from a cover scan).

**3.8 Book added confirmation [New]**
- Snackbar or brief success sheet: small cover, "Added to your library", **Lend it** / **Done**.

**3.9 Edit book [Built]**
- Fields: Title, Author, ISBN, Category, Publisher, Published (hint "A year, or a date like 1990-09-01"), Pages, Description (multiline).
- Status segmented control (Available / Lost), hidden when the book is on loan (explain why).
- **Save changes**.
- States: loading, saving, validation error.

### 8.4 Lending

**4.1 Lend a book [Built]**
- Book summary row at top.
- **Who's borrowing it?**:
  - search borrowers, borrower rows with avatars and "2 books out";
  - **Add a new borrower** reveals Name, Email (hint "They'll get an email confirming the loan, and any reminders you send."), Phone (optional), **Save borrower**;
  - selected borrower card with **Change**.
- **Due back**: chips 1 week / 2 weeks (default) / 1 month, plus **Pick a date · 29 Sep 2026**, which opens the Android date picker.
- **Lend to Chidi** (primary), with "We'll email Chidi to confirm the loan and when it's due." below.
- States:
  - no borrowers yet (form open by default);
  - choosing from the list;
  - borrower selected;
  - loan limit reached (Free: 10 loans a month);
  - borrower limit reached (Free: 5 borrowers).

**4.2 Loan created confirmation [New]**
- Snackbar: "Lent to Chidi · due 29 Sep".

**4.3 Loans [Built]**
- App bar: ☰, "Loans". Tabs: **Lent out · Overdue · Returned**.
- Loan rows: cover, title, borrower avatar + name, due text (overdue in danger).
- States: loading, list, empty per tab ("Nothing is overdue" with a happy illustration), error.

**4.4 Loan sheet [Built]**
- Book header (cover, title, author) and the loan card.
- Returned variant shows "Returned 14 Sep 2026" and no actions.

**4.5 Send reminder confirmation [Built]**
- Snackbar or dialog: "Reminder sent. We emailed Chidi a reminder to return the book."

**4.6 Reminder settings sheet [New]**
- Scheduled reminders, Premium feature.
- Options:
  - reminder type: Due soon, Overdue, Please return, Custom;
  - send date;
  - custom message (Premium);
  - toggle reminders off for this loan.
- Free and Basic variant: locked, with an upgrade prompt.

**4.7 Borrowers [New]**
- App bar: ☰, "Borrowers", search.
- Borrower rows: avatar, name, email, "2 books out" badge. Floating add button.
- States: empty ("People you lend to show up here"), list, search no match.

**4.8 Borrower details [New]**
- Avatar, name, email, phone (tap to call or email).
- Stats row: books out, total loans.
- "Has now" list of active loans, "History" list of returned loans.
- Actions: **Lend a book**, **Recommend a book**, Edit, Delete.
- Delete is disabled with active loans ("They still have 2 books").

**4.9 Add / edit borrower [New]**
- Name, Email, Phone (optional), **Save**.
- Error: "A borrower with this email already exists".

**4.10 Recommend a book [New]**
- Pick a book from your library (search + covers), your rating (1–5 stars), optional message (Premium), **Send recommendation**.
- The borrower gets an email.

### 8.5 Insights

**5.1 Stats [New]**
- Stat cards grid: Books, Borrowers, Lent out, Overdue (danger if above 0), Added this month, Average loan length ("12 days"), On-time returns ("86%").
- "Loans by month" bar chart for the last 12 months: bars in `brand`, the current month in `accent`.
- Empty state for new users.

**5.2 Activity [New]**
- Timeline grouped by day ("Today", "Yesterday", "12 Sep").
- Entries with icons, e.g. "Added 'Dune'", "Lent 'Americanah' to Chidi", "'Atomic Habits' returned", "Deleted 'Old notes'".

### 8.6 Account & plan

**6.1 Account & settings [New]**
- Profile header: large DiceBear avatar (or uploaded photo) with an edit badge, name, email, plan badge.
- Sections:
  - **Profile:** name (editable), email ("Change"; shows "Pending: new@example.com" when a change awaits confirmation), profile photo.
  - **Security:** Change password, Signed-in devices.
  - **Notifications:** Email reminders, Due date alerts, Weekly digest, New features (switches).
  - **Plan:** current plan card with a link to Plan & limits.
  - **About:** version, Terms, Privacy Policy, image credits.
  - **Danger zone:** Delete account (danger text).
  - Sign out.

**6.2 Edit profile photo sheet [New]**
- Take photo, Choose from gallery, Use generated avatar (DiceBear), Remove photo.

**6.3 Change password [New]**
- Current password, New password with rules checklist, **Save password**.
- Note: "You'll stay signed in here. Other devices will be signed out."
- Error: wrong current password.

**6.4 Change email [New]**
- New email, current password, **Send code**.
- Next screen: 6-digit code sent to the new address, **Confirm**.
- Success: "Your email is now new@example.com. Other devices were signed out."

**6.5 Signed-in devices [New]**
- List: device name ("Pixel 8"), platform icon, "Last active 2 hours ago", "This device" badge on the current one.
- Sign out button per other device, and **Sign out all other devices** (danger secondary).

**6.6 Delete account [New]**
- Warning illustration, "Delete your account?".
- What's removed: books, borrowers, loans, history. Paid subscription is cancelled.
- The user must type **DELETE** to enable the red **Delete my account** button.
- Final confirmation dialog.

**6.7 Plan & limits [New]**
- Current plan card (Free / Premium).
- Usage meters this month: Books 32 of 50, Borrowers 4 of 5, Loans this month 7 of 10, Cover scans 5 of 5 (full, in danger), Recommendations 1 of 5.
- Plan comparison cards (§9) with **Upgrade** buttons.
- Premium is $20 a year, renewing yearly. It is bought through Google Play, so don't design card-entry forms; Play shows each country its own price.

### 8.7 System states (draw once, reuse everywhere)

- **7.1 Offline / can't reach BookMack:** a banner at the top of any screen.
- **7.2 Session ended:** dialog "You've been signed out. Log in again to continue." → Log in.
- **7.3 Generic error:** illustration, "Something went wrong", **Try again**.
- **7.4 Plan limit reached sheet:** which limit, usage meter, **See plans**, **Not now**.
- **7.5 Loading:** skeletons for shelf, lists and the details sheet.

---

## 9. Plans (real limits, use in usage meters and comparison cards)

| | Free | Premium ($20 a year) |
|---|---|---|
| Books | 50 | Unlimited |
| Borrowers | 5 | Unlimited |
| Loans per month | 10 | Unlimited |
| Cover scans per month | 5 | 100 |
| Recommendations per month | 5 | Unlimited |
| Automatic scheduled reminders | – | ✓ |
| Custom recommendation messages | – | ✓ |
| Add many books at once | – | ✓ |
| Export to CSV | – | ✓ |
| Export to PDF | – | ✓ |

Barcode lookups are free and unlimited on both plans; only AI cover scans are capped.

---

## 10. Copy rules and sample content

**Copy**
- **Tone:** short, plain and friendly. Say what happened and what to do next.
- **Case:** sentence case. No exclamation marks except in success confirmations.
- **Dates:**
  - Relative when near: "Due today", "Due tomorrow", "Overdue by 3 days".
  - Otherwise "29 Sep 2026".
  - Timestamps: "2 hours ago".
- **Password rules text:** "At least 8 characters", "An uppercase letter", "A lowercase letter", "A number", "A special character".

**Sample user**
- Adaeze Okafor, `ada@example.com`, Free plan.

**Sample borrowers**
- Chidi Obi (`chidi.obi@example.com`, 2 books out)
- Tolu Adeyemi (`tolu.a@example.com`)
- Ngozi Eze (`ngozi.eze@example.com`, 1 overdue)
- Kemi Balogun (`kemi.b@example.com`)

**Sample books** (use Open Library covers: `https://covers.openlibrary.org/b/isbn/<ISBN>-M.jpg`)

| Title | Author | ISBN | Notes |
|---|---|---|---|
| Things Fall Apart | Chinua Achebe | 9780385474542 | Available |
| Americanah | Chimamanda Ngozi Adichie | 9780307455925 | On loan to Chidi, due tomorrow |
| Half of a Yellow Sun | Chimamanda Ngozi Adichie | 9781400095209 | On loan to Ngozi, overdue by 3 days |
| Dune | Frank Herbert | 9780441172719 | Available |
| Atomic Habits | James Clear | 9780735211292 | Returned by Tolu on 14 Sep 2026 |
| The Famished Road | Ben Okri | 9780385425131 | Lost |
| My Notebook of Poems | Adaeze Okafor | *(no ISBN)* | No cover; use the typographic placeholder |

---

## 11. Checklist before you finish a section

- [ ] Only the colors in §4, and at most one dark green primary button per screen.
- [ ] Bricolage Grotesque for headings, Plus Jakarta Sans for everything else.
- [ ] Every state listed for the section has its own labelled frame.
- [ ] Touch targets are 48 px or larger, and text meets contrast.
- [ ] Vector background only on the screens allowed in §6.
- [ ] DiceBear images use the 10.x URL format and the CC0 styles listed.
- [ ] No wood textures, no copied looks from other apps, no lorem ipsum.
