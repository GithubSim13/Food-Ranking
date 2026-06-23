# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See ROADMAP.md for planned future features, in-progress work, and completed feature history.

## Stack

- **Client** (`/client`): React + Vite (TypeScript), TanStack Query, React Router v6, axios
- **Server** (`/server`): Node.js + Express (TypeScript) + Prisma ORM
- **Database**: PostgreSQL 17, local, port 5432, db `food_ranking`
- **Mobile**: Capacitor (planned)

## Environment

- **OS**: Windows, PowerShell — do not use `&&` to chain commands; use `;` instead
- **Claude Code**: run in a standalone terminal, not inside VS Code

## Commands

### Client (`/client`)
```bash
npm run dev       # dev server on http://localhost:5173
npm run build     # production build
npm run preview   # preview production build
```

### Server (`/server`)
```bash
npm run dev       # ts-node-dev watch mode on http://localhost:3000
npm run build     # compile TypeScript → dist/
npm run start     # run compiled output

npm run db:migrate   # prisma migrate dev (requires running PostgreSQL)
npm run db:studio    # Prisma Studio GUI
npm run db:generate  # regenerate Prisma client after schema changes
```

### Import script (`/server`)
```bash
npx ts-node src/scripts/import.ts <path-to-entries.md>           # normal import
npx ts-node src/scripts/import.ts <path-to-entries.md> --clear   # wipe + reimport
```

### One-off scripts (`/server`)
```bash
npx ts-node src/scripts/setAllRetroactive.ts   # sets uncertainRating = true on all existing reviews (already run)
```
Safe to re-run. `--clear` deletes in FK-safe order (Reviews → Entries → Restaurants). Call `dotenv.config()` before importing PrismaClient; run from `/server` directory. Google Docs flag emoji (🇸🇬) exports as garbled CP437 — script detects and converts to 2-letter ISO code in `Entry.flag`.

## Architecture

### Data model (`server/prisma/schema.prisma`)

```
Restaurant ──< Entry ──< Review
```

- **Restaurant** — `id`, `name` (`@unique` — enforced by migration `20260619000000_restaurant_name_unique`; `entries.ts` uses a case-insensitive `findFirst` on name to reuse existing rows instead of creating duplicates), `notes` (String?, nullable — free-text notes, editable on RestaurantsPage; returned by `GET /api/restaurants`)
- **Entry** — `id`, `foodName`, `category`, `restaurantId`, `starred` (bool), `flag` (String?, nullable 2-letter ISO code), `manualRank` (Int?, nullable — per-category drag order), `tryAgain` (Boolean, default false), `neverAgain` (Boolean, default false), `createdAt`, `updatedAt`
- **Review** — `id`, `entryId`, `date?` (DateTime, nullable), `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `price?` (Float, nullable — cost in ₱ at time of visit), `uncertainRating` (Boolean, default false, renamed from `retroactive`), `createdAt`

`Entry.flag`: nullable ISO 3166-1 alpha-2 code. `null` = eaten locally; non-null = eaten abroad.

`Entry.manualRank`: nullable integer for drag-and-drop order within a category. `null` = unranked. Lower value = higher position.

The generated Prisma client lives at `server/src/generated/prisma/` (Prisma v6, **not** `@prisma/client`). Always import via the singleton at `src/lib/prisma.ts`.

### Server structure

```
server/
  src/
    index.ts            # Express entry, mounts routers
    lib/
      prisma.ts         # PrismaClient singleton
      routeHelpers.ts   # parseId(), restaurantNameSelect
    routes/
      entries.ts        # /api/entries routes
      rankings.ts       # /api/rankings routes
      reviews.ts        # /api/reviews routes
      restaurants.ts    # /api/restaurants routes
      categories.ts     # /api/categories routes
    scripts/
      import.ts         # bulk import from entries.md
    generated/prisma/   # auto-generated Prisma client (do not edit)
  prisma/
    schema.prisma       # data model
    migrations/         # migration history
  prisma.config.ts      # Prisma v6 config (loads DATABASE_URL via dotenv)
  .env                  # local env vars — copy from .env.example
```

### API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check — `{ status: "ok" }` |
| GET | `/api/entries` | All entries newest first; includes reviews array with ratings |
| GET | `/api/entries/:id` | Single entry with full restaurant + reviews |
| POST | `/api/entries` | Create entry; find-or-creates restaurant |
| PATCH | `/api/entries/:id` | Partial update of entry fields |
| DELETE | `/api/entries/:id` | Delete entry and all its reviews |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search for duplicate detection |
| POST | `/api/reviews` | Create review; `overallRating` computed server-side |
| PUT | `/api/reviews/:id` | Update review; `overallRating` recomputed server-side |
| DELETE | `/api/reviews/:id` | Delete a single review |
| GET | `/api/rankings` | Entries grouped by category; rated by `overallRating` desc, unrated by `manualRank` asc |
| PATCH | `/api/rankings/reorder` | Persist drag order — body: `{ category, orderedIds[] }` |
| GET | `/api/categories` | Distinct categories with entry count, alphabetically |
| PATCH | `/api/categories/:name` | Rename category; bulk-updates all entries |
| DELETE | `/api/categories/:name` | Delete category — only if no entries assigned |
| GET | `/api/restaurants` | All restaurants with entry count, alphabetically |
| PATCH | `/api/restaurants/:id` | Edit restaurant `name` and/or `notes` (nullable) |
| DELETE | `/api/restaurants/:id` | Delete restaurant — only if no entries |

#### overallRating computation (server-enforced)
Weighted average of non-null ratings: `rating1` (Taste) 60%, `rating2` (Value) 10%, `rating3` (Consistency) 30%. Weights redistributed proportionally when some are null. All null → `overallRating` is null. Clients must never send `overallRating`.

### Client structure

```
client/src/
  api/
    entries.ts          # getEntries, getEntry, searchEntries, createEntry, patchEntry, deleteEntry
    reviews.ts          # createReview, updateReview, deleteReview
    rankings.ts         # getRankings, reorderCategory
    restaurants.ts      # getRestaurants, patchRestaurant, deleteRestaurant
    categories.ts       # getCategories, renameCategory, deleteCategory
  components/
    layout/
      AppShell.tsx      # sidebar nav + footer; unrated count badge on Rate link
    common/
      Modal.tsx         # reusable modal overlay, ESC/backdrop to close
      Toast.tsx / ToastContainer.tsx  # auto-dismiss toasts, stacked bottom-right
      FlagImage.tsx     # renders SVG flag from country-flag-icons
      FlagPicker.tsx    # searchable country dropdown
      countryList.ts    # static list of 250 { code, name } pairs (do not hand-edit)
      Icons.tsx         # PencilIcon, TrashIcon, ChevronIcon, BoltIcon; pair with "icon-btn"/"icon-btn-danger"
      SectionErrorBoundary.tsx  # error boundary for Home dashboard sections
      EntryFlagBadges.tsx  # renders tryAgain/neverAgain/uncertainRating badge dots
      SearchAndScopeBar.tsx  # sticky search + scope filter pills; exports pillStyle(), matchesScope(), Scope type; sets --search-bar-height via ResizeObserver
      CategoryComparisonPanel.tsx  # rated entries in same category by overallRating desc; hover popup shows restaurant + latest review notes
      pageStyles.ts     # shared inline styles (kickerStyle, pageTitleStyle, button size constants)
    NotFoundPage.tsx    # 404 catch-all, Minecraft achievement style
    home/
      HomePage.tsx         # / — assembles all home sections
      HomeShared.tsx       # shared primitives: Card, SectionLabel, RankRow, firstNoteLine(), Top5Entry type
      PodiumSection.tsx    # Hall of Fame + Hall of Shame podium with scroll animations
      ReigningChampionCard.tsx  # Best of the Month card; falls back to all-time; gold if starred
    analytics/
      AnalyticsPage.tsx # /analytics — all computed from ['entries'] query; scroll-triggered animations; local date parsing uses split('-') not new Date(); Category Insights uses a combobox-style selector (search input + selected category pill, dropdown list on demand) instead of pills; Rating Trajectory is a hybrid list + detail chart — list of movers (2+ rated reviews) with delta badges, click a row to expand a single-entry Recharts line chart below it, click again to collapse
    entries/
      EntryList.tsx     # /entries — card grid with search, scope filters, and sort pills; "Most Recent" sorts by review.createdAt (DB insertion time), not review.date
      EntryCard.tsx     # entry card; gold when starred; shows flag, rating, badge dots
      EntryForm.tsx     # /entries/new — dupe detection, FlagPicker, combo boxes, tryAgain/neverAgain toggles, optional inline review (with price field), CategoryComparisonPanel
      EntryDetail.tsx   # /entries/:id — entry info, inline editing, toggles, reviews list, ReviewForm, delete
      EntryModal.tsx    # modal wrapper around EntryDetail
    reviews/
      ReviewForm.tsx    # add/edit review: ratings, date, price, notes, uncertainRating checkbox
      RatingInput.tsx   # slider + number input, 0–10, red→yellow→green gradient
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category; DnD for unrated (Edit Rankings mode); Move Entries mode; ?category= pre-fills search
    categories/
      CategoriesPage.tsx  # /categories — sortable table; row click → /rankings?category=<name>; rename/delete
    restaurants/
      RestaurantsPage.tsx # /restaurants — masonry card grid (CSS columns, 3/2/1 cols); avatar + avg rating bar + notes block; expandable entry rows per card (click-through to entry detail); inline in-place edit mode (name + autoResize notes textarea); edit/delete icons top-right; full-width search + sort pills (name/foods/avg). RestaurantSummary type carries nullable notes field
    rate/
      QuickRatePage.tsx  # /rate — queue of unrated entries; one-at-a-time card with sliders; Skip/Save; progress bar
  context/
    ToastContext.tsx    # ToastProvider + useToast() hook
  types.ts              # Entry, EntryDetail, Review, RankedEntry, Rankings, CategorySummary, RestaurantSummary; RATING_FIELDS
  utils.ts              # sortReviewsByDateDesc, latestRating, latestRatedReview, latestPrice, scoreColor, formatReviewDate, getLocalDateString(), autoResize() — applied on load (useEffect with value dep), onChange, and onPaste (setTimeout 0) across all notes textareas
  App.tsx               # routes + background-location modal pattern for /entries/:id
  main.tsx              # QueryClientProvider + BrowserRouter + ToastProvider; staleTime: 5min globally
```

### Key behaviours

- **Vite proxy**: `/api` → `http://localhost:3000`
- **Design system**: Ube Midnight dark palette — CSS variables in `index.css` (`--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-mute`, `--line`, `--accent`, `--accent-wash`, `--accent-ink`, `--gold`, `--gold-wash`, `--danger`, `--danger-wash`, `--danger-border`, `--accent-light`, `--accent-soft`, `--toast-*`, etc.). Fonts via `--font-display` (Bricolage Grotesque), `--font-body` (Hanken Grotesk), `--font-mono` (Space Mono) — never hardcode. All UI uses CSS variables — no hardcoded colors.
- **UI consistency**: form inputs `padding: 0.45rem 0.65rem`; small buttons use `pageStyles.ts` constants; use `className="pill"` / `"icon-btn"` / `"icon-btn-danger"` for hover states; pending buttons `opacity: 0.6`; icon/flag-to-label gap `0.4rem`.
- **Avg rating**: computed client-side from `reviews[].overallRating` (null excluded); displayed as `toFixed(2)`; shows "Unrated" when null.
- **Toast + query invalidation**: all mutations show toast via `useToast()`; invalidate `['entries']`, `['entries', id]`, `['rankings']`, `['restaurants']`, `['categories']` as appropriate.
- **Uncertain rating**: `Review.uncertainRating` — checkbox in forms; badge on review cards; yellow dot on entry detail from latest review.
- **Review price**: optional Float (₱); shown as `₱{price} · {date}` on review cards.
- **Entry flags (tryAgain/neverAgain)**: mutually exclusive XOR; badge dots on cards; filter pills on Entries page; also settable at new entry creation via toggle buttons on EntryForm.
- **Entry detail modal**: card click opens EntryDetail in Modal; URL updates to `/entries/:id`; ESC/backdrop closes; direct nav renders full page.
- **Error handling**: all async route handlers wrapped in try/catch; 500 on DB failure, 400 on bad ID, 404 on missing record.
- **Rankings DnD**: only unrated entries; gated behind Edit Rankings; Cancel restores snapshot; rated entries always sort by `overallRating` desc.
- **Move Entries (Rankings)**: locks source category, toggles selection, confirms → `PATCH /api/entries/bulk-move`; move and edit modes are mutually exclusive.
- **Category Comparison Panel**: visible on entry detail when review form is open; expands modal width.
- **Form validation**: React-side only — no native `required` anywhere; inline error messages clear on input change.
- **Partial sub-ratings**: null sub-ratings valid; `overallRating` redistributes weights; QuickRatePage requires all three (client-side only).
- **Home dashboard**: all sections computed from cached `['entries']` query — do not add new API calls; date comparisons use `split('-')` not `new Date()` to avoid UTC offset issues.

### Home dashboard sections

| Section | Computation |
|---------|-------------|
| **Greeting** | Entry count + distinct categories; greeting word changes by hour |
| **Stat row** | Distinct categories, total entries, starred count, restaurant count |
| **🏆 Hall of Fame** | Top 5 by overallRating; upward podium order 4/2/1/3/5 |
| **💀 Hall of Shame** | Bottom 5 rated; downward podium mirroring Fame |
| **Best of the Month** | Highest-rated entry this calendar month; falls back to all-time; gold if starred |
| **Fresh off the fork** | 5 most recent by earliest non-null review.date |
| **About** | Static; entry count callout + "est. 2025" |

### Environment

Copy `server/.env.example` to `server/.env` and fill in:
```
DATABASE_URL="postgresql://user:password@localhost:5432/food_ranking?schema=public"
PORT=3000
CLIENT_URL=http://localhost:5173
```

Run `npm run db:migrate` after setting up PostgreSQL.

## Hosting & Auth

Planned deployment to Vercel + Railway with dual Postgres DBs (real + demo), Basic Auth over HTTPS, and IP-based lockout. See ROADMAP.md §3 for the full spec.

## AI Model & Effort Guide

Use the right model and effort level for the task:

- **Sonnet + low/medium effort** — default for almost everything: new features, bug fixes, UI work, new components, new API routes, wiring pages, routine refactors
- **Opus + high effort** — step up for tasks requiring deeper judgment: architecture decisions, debugging subtle cross-system issues (e.g. cache/invalidation bugs spanning client + server), reviewing complex files for correctness or performance
- **Fable + high effort** — only for large end-to-end autonomous tasks: implementing Hosting & Auth in full (dual Prisma clients, auth middleware, IP lockout, demo mode, Capacitor credentials), or any large cross-cutting refactor spanning many files at once

File casing: filenames are case-sensitive. Always write CLAUDE.md and ROADMAP.md in all-caps. Never rename or recreate them as Claude.md or Roadmap.md.
