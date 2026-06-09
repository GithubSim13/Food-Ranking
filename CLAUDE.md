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
Safe to re-run: upserts entries, backfills reviews and flags for entries that have none yet.

`--clear` deletes in FK-safe order (Reviews → Entries → Restaurants), prints a confirmation with counts, then runs the full import.

**Important:** The script calls `dotenv.config()` before importing PrismaClient — this order is required because Prisma reads `DATABASE_URL` at import time. Run from the `/server` directory so `.env` is resolved correctly.

**Flag parsing:** The Google Docs export corrupts flag emoji (e.g. 🇸🇬) into garbled CP437 sequences (e.g. `≡ƒç╕≡ƒç¼`). The script detects these in restaurant names, extracts the 2-letter ISO country code (e.g. `SG`), stores it in `Entry.flag`, and strips the garbage from the restaurant name. A scan report is always printed before any DB writes so the mapping can be verified.

## Architecture

### Data model (`server/prisma/schema.prisma`)

```
Restaurant ──< Entry ──< Review
```

- **Restaurant** — `id`, `name`
- **Entry** — `id`, `foodName`, `category`, `restaurantId`, `starred` (bool), `flag` (String?, nullable 2-letter ISO code), `manualRank` (Int?, nullable — per-category drag order), `tryAgain` (Boolean, default false), `neverAgain` (Boolean, default false), `createdAt`, `updatedAt`
- **Review** — `id`, `entryId`, `date?` (DateTime, nullable), `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `uncertainRating` (Boolean, default false, renamed from `retroactive`), `createdAt`

`Entry.flag` is a nullable 2-letter ISO 3166-1 alpha-2 country code (e.g. `"SG"`, `"JP"`). `null` means the food was eaten locally (home country). Non-null means eaten abroad.

`Entry.manualRank` is a nullable integer used to persist drag-and-drop order within a category on the Rankings page. `null` means unranked (new entries). Lower value = higher position within the drag order tier.

The generated Prisma client lives at `server/src/generated/prisma/` (Prisma v6 TypeScript client, **not** the default `@prisma/client`). Always import via the singleton at `src/lib/prisma.ts`.

### Server structure

```
server/
  src/
    index.ts            # Express entry — mounts routers, health check
    lib/
      prisma.ts         # PrismaClient singleton
      routeHelpers.ts   # shared route utilities: parseId() (validates integer param, returns 400 on bad input), restaurantNameSelect (reusable Prisma select fragment)
    routes/
      entries.ts        # /api/entries routes
      rankings.ts       # /api/rankings route
      reviews.ts        # /api/reviews routes
      restaurants.ts    # /api/restaurants routes
      categories.ts     # /api/categories routes
    scripts/
      import.ts         # bulk import from entries.md markdown format
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
| GET | `/api/entries` | All entries, newest first; includes `reviews: [{ overallRating, date, rating1, rating2, rating3, notes, uncertainRating }]` |
| GET | `/api/entries/:id` | Single entry with full restaurant + reviews, ordered by `createdAt` asc |
| POST | `/api/entries` | Create entry — body: `{ foodName, category, restaurantName, starred?, flag? }`. Find-or-creates restaurant. |
| PATCH | `/api/entries/:id` | Partial update — body: `{ starred?, foodName?, category?, flag?, tryAgain?, neverAgain? }`. Only provided fields are written. |
| DELETE | `/api/entries/:id` | Delete entry and all its reviews. |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search (ILIKE) for duplicate detection |
| POST | `/api/reviews` | Create review — body: `{ entryId, date?, rating1?, rating2?, rating3?, notes?, uncertainRating? }`. `overallRating` computed server-side. |
| PUT | `/api/reviews/:id` | Update review — same optional fields as POST including `uncertainRating?`. `overallRating` recomputed server-side. |
| DELETE | `/api/reviews/:id` | Delete a single review. |
| GET | `/api/rankings` | All entries grouped by category, alphabetically sorted by category name; within each category: rated entries by `overallRating` desc (latest review's), unrated by `manualRank` asc nulls last. Includes `flag`, `manualRank`, `tryAgain`, `neverAgain` per entry. |
| PATCH | `/api/rankings/reorder` | Persist drag order — body: `{ category: string, orderedIds: number[] }`. Writes `manualRank` (0-based index). |
| GET | `/api/categories` | Distinct categories with entry count — `[{ name, entryCount }]`, sorted alphabetically. |
| PATCH | `/api/categories/:name` | Rename a category — body: `{ name: string }`. Bulk-updates all entries. `:name` is URL-encoded. |
| DELETE | `/api/categories/:name` | Delete a category — only if no entries assigned to it. |
| GET | `/api/restaurants` | All restaurants with entry count — `[{ id, name, entryCount }]`, sorted alphabetically. |
| PATCH | `/api/restaurants/:id` | Edit restaurant name — body: `{ name: string }`. |
| DELETE | `/api/restaurants/:id` | Delete a restaurant — only if it has no entries. |

#### overallRating computation (server-enforced)
`overallRating` is a **weighted average** of non-null ratings:
- `rating1` (Taste): 60%
- `rating2` (Value): 10%
- `rating3` (Consistency): 30%

Weights are redistributed proportionally when some ratings are null. If all three are null, `overallRating` is null. Clients must never send `overallRating` — it is always overwritten.

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
      AppShell.tsx      # sidebar nav: Home, Entries, Rankings, then EXPLORE: Categories, Restaurants, Analytics (with ChartBarIcon); footer shows entry count ("N lamons logged"), restaurant count ("N spots visited"), starred count ("N stand-out stars"), "est. 2025"
    common/
      Modal.tsx         # reusable modal overlay: dark themed, ESC/backdrop to close
      Toast.tsx         # single toast notification, auto-dismisses after 3s, success/error variants
      ToastContainer.tsx  # renders active toasts stacked in bottom-right
      FlagImage.tsx     # renders SVG flag from country-flag-icons; null → nothing, unknown code → text fallback
      FlagPicker.tsx    # searchable country dropdown, dark themed; props: { value: string | null, onChange }
      countryList.ts    # static list of 250 { code, name } pairs (auto-generated, do not hand-edit)
      Icons.tsx         # shared icon components: PencilIcon, TrashIcon, ChevronIcon, iconBtnStyle
      SectionErrorBoundary.tsx  # class-based React error boundary; wraps each Home dashboard section; shows "Could not load [title]" fallback on error
      EntryFlagBadges.tsx  # renders the three 8×8px badge dots (tryAgain, neverAgain, uncertainRating) using --badge-try-again, --badge-never-again, --badge-uncertain CSS variables; used in EntryCard.tsx
      SearchAndScopeBar.tsx  # reusable sticky search bar + scope filter pills; exports SearchAndScopeBar component, pillStyle(), matchesScope(), and Scope type; used by EntryList and RankingsPage; sets --search-bar-height CSS variable via ResizeObserver for sticky category headers
      CategoryComparisonPanel.tsx  # panel showing other rated entries in the same category sorted by overallRating desc; props: { category, currentEntryId? }; displays rank, food name, overallRating, T/V/C; hover shows portal popup with restaurant name + latest review notes; used in EntryForm and EntryDetail
      pageStyles.ts     # shared inline style objects: kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle, smallDeleteBtnStyle
    NotFoundPage.tsx    # catch-all 404 page — Minecraft "How did we get here?" achievement toast, bounces in from top with idle bob animation, ghost 404 background text, Go Home button; matched by <Route path="*"> in App.tsx
    NotFoundPage.module.css  # CSS module for NotFoundPage animations and layout
    home/
      HomePage.tsx         # / — dashboard root; assembles Greeting, Stat row, PodiumSection, ReigningChampionCard + Fresh off the Fork; ~151 lines
      HomeShared.tsx       # shared primitives: Card, SectionLabel, RankRow components; firstNoteLine() helper; Top5Entry type; used across home sub-components and AnalyticsPage
      PodiumSection.tsx    # Hall of Fame + Hall of Shame podiums; scroll-driven reveal; staggered bar/watermark animations
      ReigningChampionCard.tsx  # most-reviewed starred entry; purple stripe card; hidden if no starred entries have reviews
    starred/
      StarredPage.tsx   # starred entries grouped by category; exists but unused — /starred route redirects to /entries in App.tsx
    analytics/
      AnalyticsPage.tsx # /analytics — stats and insights page; sections: Overview stat row (4 cards: avg rating, starred count, good %, try again count), Rating Distribution donut chart, Starred Ratio donut chart, Top Categories by Avg Rating (min 2 rated entries), Best Restaurants by Avg Rating (min 2 rated entries), Best Spot per Category (category filter pills, min 2 entries per restaurant), Rating Trajectory movers (entries with 2+ reviews, filter: improved/declined/all), Starred Picks grid; all computed client-side from ['entries'] query
    entries/
      EntryList.tsx     # /entries — responsive card grid (3 columns desktop, 2 tablet, 1 mobile) + search + scope filters (Everything/Starred/Abroad/Home/Try Again/Never Again/Uncertain) + sort pills (Most recent/Top rated/A-Z); search covers name/category/restaurant (substring) and review notes (whole-word regex); when search is active, sort pills are greyed out/disabled and results are priority-sorted (whole-word matches first, partial matches second); sort pills resume normal behaviour when search is cleared; Uncertain filter checks latest review only
      EntryCard.tsx     # card: flag SVG + food name + quote (first line of latest review notes, 2-line clamp, omitted if no notes) + category · restaurant + rating pinned bottom right + badge dots (blue=tryAgain, red=neverAgain, yellow=uncertainRating on latest review); gold styling when starred
      EntryForm.tsx     # /entries/new — form + live dupe detection (list format) + FlagPicker + category combo box + restaurant combo box (fetches GET /api/restaurants) + optional inline review section (toggle, RatingInput for Taste/Value/Consistency, Notes, date auto-set to local YYYY-MM-DD string at POST time (uses local calendar date, not UTC, to avoid midnight UTC+8 offset issues)) + Category Comparison Panel when review section is open + React-side validation (no native HTML validation)
      EntryDetail.tsx   # /entries/:id — entry info + inline editing + star toggle + tryAgain/neverAgain toggle buttons (XOR, colored dot + label, patchEntry on click) + uncertainRating display badge (yellow dot, derived from latest review, read-only) + reviews list + ReviewForm + delete entry/review; fully dark themed
      EntryModal.tsx    # modal wrapper around EntryDetail; onClose navigates back
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency via RatingInput component + date + notes + uncertainRating checkbox ("Ratings added after the fact"); rating inputs also clamped in edit form
      RatingInput.tsx   # reusable rating field: label (left) + range slider (full red→yellow→green spectrum gradient, 6px track) + number input (right, 70px fixed width); fully synced bidirectionally; clamped 0–10 on onChange; step="any" for decimal precision; used in all review add/edit forms
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category alphabetically; rated entries sorted by overallRating desc (automatic); unrated entries below, drag-and-drop reorder via @dnd-kit (gated behind Edit Rankings mode); search bar + scope filters (Everything/Starred/Abroad/Home); reads ?category= URL param on mount to pre-fill search bar (used by CategoriesPage card clicks); search covers name/category/restaurant (substring) and review notes (whole-word regex); when search is active, results are priority-sorted within each category group (whole-word matches first, partial matches second)
    categories/
      CategoriesPage.tsx  # /categories — full-width sortable table (columns: #, Category, Entries, Avg rating, Actions); search bar top-right; clicking a row navigates to /rankings?category=<name>; sort by any column asc/desc (default: Category asc); avg rating cell shows color-coded score + inline proportional bar; pencil/trash icon buttons for rename/delete
    restaurants/
      RestaurantsPage.tsx # /restaurants — full-width sortable table matching CategoriesPage structure. Columns: # (1-based index in current sort order), Restaurant (with 36×36px initials avatar — 2-char max, color-cycled by index % 5, border-radius: 8px, font-family: var(--font-mono)), Foods (entry count, right-aligned), Avg Rating (color-coded score + inline proportional bar, — if unrated), Actions (pencil + trash). Sort via column header clicks (Restaurant/Foods/Avg Rating), default Restaurant asc. Search bar top-right (mirrors Categories page placement). Clicking a row (except action buttons) toggles a <tr colSpan={6}> sub-table showing that restaurant's entries: Flag (FlagImage size 16) | Food name | Category | Rating (via scoreColor()). Chevron on each row rotates 90° when expanded.
  context/
    ToastContext.tsx    # ToastProvider + useToast() hook; showToast(message, variant?)
  types.ts              # Entry, EntryDetail, Review (includes uncertainRating), RankedEntry (includes tryAgain, neverAgain), Rankings, CategorySummary, RestaurantSummary
  utils.ts              # shared helpers: sortReviewsByDateDesc, latestRating, latestRatedReview, scoreColor, formatReviewDate
  App.tsx               # routes + React Router background-location modal pattern for /entries/:id; /starred redirects to /entries; catch-all <Route path="*"> renders NotFoundPage
  main.tsx              # QueryClientProvider + BrowserRouter + ToastProvider + ToastContainer
```

### Key behaviours

- **Vite proxy**: `/api` → `http://localhost:3000`
- **Design system**: Ube Midnight dark palette — CSS variables (`--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-mute`, `--line`, `--accent`, `--accent-wash`, `--accent-ink`, `--gold`, `--gold-wash`, `--line-soft`, etc.) in `index.css`. Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), Space Mono (mono). All modals, dropdowns, inputs, and buttons use CSS variables — no hardcoded light colors anywhere. `index.css` also defines `.hall-title-fame` (green glow text-shadow for Hall of Fame backdrop title) and `.hall-title-shame` (red glow text-shadow for Hall of Shame backdrop title).
- **Dupe detection**: debounced 300ms on foodName input (>2 chars), calls `GET /api/entries/search?q=`, shows matches as a readable list (name, restaurant, category per item)
- **Avg rating on cards**: computed client-side from `reviews[].overallRating` (null values excluded); displayed as `toFixed(2)`, shows "Unrated" when null
- **Toast notifications**: all mutations show a success or error toast via `useToast()` from `ToastContext`
- **Query invalidation**: after any mutation, relevant TanStack Query keys invalidated for immediate UI update — `['entries']`, `['entries', id]`, `['rankings']`, `['restaurants']`, `['categories']` as appropriate
- **Starred entries**: gold card styling on entry list and rankings; toggle button on entry detail page
- **Review notes**: stored as newline-separated text; rendered as `<ul><li>` bullet list
- **Uncertain rating**: `Review.uncertainRating` boolean (renamed from `retroactive`) — when true, review card shows a small muted clock badge "ratings added later". Checkbox ("Ratings added after the fact") in both new and edit review forms.
- **Entry flags**: `Entry.tryAgain` and `Entry.neverAgain` booleans — mutually exclusive (XOR enforced at app layer via patchEntry). Toggle buttons on entry detail show a colored dot (blue=tryAgain, red=neverAgain) + label; clicking an active flag turns it off, clicking an inactive one turns it on and clears the other. `uncertainRating` on entry detail is a read-only display badge (yellow dot + "Uncertain Rating") derived from whether the **latest review** has `uncertainRating: true`. Badge dots on entry cards (8×8px circles, bottom-right area) rendered by the shared `EntryFlagBadges` component using CSS variables `--badge-try-again` (blue), `--badge-never-again` (red), `--badge-uncertain` (yellow); used in EntryCard.tsx. Filter pills on Entries page: Try Again, Never Again, Uncertain (Uncertain filter checks latest review only).
- **Inline review editing**: Edit button on each review card; saves via PUT /api/reviews/:id; includes uncertainRating checkbox
- **Inline entry editing**: Edit button on `/entries/:id` — edits foodName, category (combo box), flag (FlagPicker), restaurant name. Fires PATCH /api/restaurants/:id and PATCH /api/entries/:id in parallel if both changed.
- **Delete flows**: Delete Entry button on entry detail (confirms, deletes entry + all reviews, navigates to /entries). Delete button on each review card. Categories/Restaurants block delete if entries exist.
- **Flag display**: `FlagImage` renders SVG flags everywhere. Falls back to raw text for unknown codes; renders nothing for null.
- **FlagPicker**: searchable dropdown, dark themed — type country name or ISO code. Arrow-key navigation, Enter/Escape/click-outside support.
- **Entry detail modal**: clicking an entry card anywhere opens `EntryDetail` inside `Modal.tsx`. URL updates to `/entries/:id`. ESC or backdrop closes. Direct navigation renders as full page.
- **Error handling**: all 17 async route handlers wrapped in try/catch — DB failures return 500 instead of crashing the process; invalid IDs return 400; missing records return 404
- **Entry detail error states**: GET /api/entries/:id returning 400 or 404 renders an "Entry not found" message with back button instead of infinite loading
- **404 page**: unmatched routes render NotFoundPage via catch-all `<Route path="*">` — Minecraft achievement toast style, Ube Midnight palette, bounces in from top with idle bob, ghost 404 background text, "This page has no rating. We've checked." copy, Go Home button.
- **Error boundaries**: each Home dashboard section wrapped in SectionErrorBoundary — a section crash shows a muted fallback without affecting the rest of the page
- **Rankings drag-and-drop**: only applies to unrated entries. Gated behind "Edit Rankings" button. Save persists order via `PATCH /api/rankings/reorder`; Cancel restores snapshot. Rated entries always sort by `overallRating` desc automatically — `manualRank` is ignored for them (values left in DB, not wiped).
- **Rankings search + filters**: same search bar and scope filter pills as Entries page (Everything / ★ Starred / Abroad / Home). Category groups with zero matches are hidden.
- **Category Comparison Panel**: visible on entry detail when a review form is open (new or edit). Shows other rated entries in the same category sorted by `overallRating` desc. Displays food name, overallRating, and Taste/Value/Consistency breakdowns (— if null). Unrated entries hidden. Panel appears to the right; modal expands wider to accommodate it. Hovering a row shows a popup with the restaurant name and the full notes from the latest review only (split on newlines, rendered as a bullet list, using `sortReviewsByDateDesc` logic); T/V/C and review count are not repeated in the popup as they're already visible in the row.
- **Category combo box**: on new entry form, shows existing categories as dropdown, allows free-text new category.
- **Restaurant combo box**: on new entry form, mirrors category combo box — fetches from GET /api/restaurants, shows existing names, allows free-text new restaurant.
- **Form validation**: all forms use React-side validation — no native HTML `required` attributes anywhere. Invalid fields show inline error messages below the field (danger CSS variable color, Hanken Grotesk, ~0.85rem); errors clear on input change.
- **Rating inputs (RatingInput component)**: reusable `RatingInput` component used across all review forms. Layout: label left, slider middle (fills remaining width), number input right (fixed ~70px). Slider track is always a full red → yellow → green spectrum gradient (`linear-gradient(to right, #e74c3c, #f39c12, #2ecc71)`), 6px height, white thumb. Slider and number input fully synced. Clamped 0–10 on `onChange` for both. `step="any"` on number input, `step="0.01"` on slider. Empty (null) = slider sits at 0 visually but does not write a value until user interacts.
- **Home dashboard**: all sections computed client-side from the cached `['entries']` query — do not add new API calls. Fresh off the fork uses the earliest non-null `review.date` per entry — entries with no dated reviews are excluded.

### Home dashboard sections

Sections (top to bottom) and how to compute each:

| Section | Computation |
|---------|-------------|
| **Greeting** | Total entry count, distinct category count; greeting word changes by hour (Morning/Afternoon/Evening) |
| **Stat row** | Distinct category count (`new Set(entries.map(e => e.category)).size`, same value used in Greeting); total entries; count where `starred === true`; distinct restaurant count — all four cards are visually uniform (no accent border) |
| **🏆 Hall of Fame** | Top 5 entries by highest overallRating (latest review per entry); full-width upward podium — bars grow upward, `alignItems: 'flex-end'` row, purple color scheme; order left to right: 4, 2, 1, 3, 5; bar heights: #1=65%, #2=50%, #3=40%, #4=28%, #5=18%; label (flag + name + score) above each bar; inside bars 1–3: scaled rank number (no emoji) + category + restaurant + review count + italic quote (first line of latest review notes via `sortReviewsByDateDesc`, 2-line clamp); inside bars 4–5: scaled rank number only; rank font sizes: #1=2.2rem, #2=1.7rem, #3=1.35rem, #4=1.05rem, #5=0.9rem, weight 800; bar background is `linear-gradient(to bottom, <barColor>, transparent)` — solid at top, fades to transparent at divider; clicking any bar opens entry modal via background-location pattern; large backdrop watermark "🏆 Hall of Fame" with `.hall-title-fame` green glow, split into per-character `<span>`s for staggered letter animation |
| **💀 Hall of Shame** | Bottom 5 rated entries (min one review) sorted by overallRating asc; full-width downward podium directly below Hall of Fame — bars grow downward, `alignItems: 'flex-start'` row, orange color scheme; same 5-column order; bar depths mirror fame heights; label (flag + name + score) below each bar; inside bars 1–3: scaled rank number (no emoji) + category + restaurant + review count + italic quote (same pattern as fame); bar background is `linear-gradient(to top, <barColor>, transparent)` — solid at bottom, fades to transparent at divider; clicking any bar opens entry modal; large in-flow watermark "💀 Hall of Shame" with `.hall-title-shame` red glow below bars, split into per-character `<span>`s for staggered letter animation |
| **Reigning Champion** | Most-reviewed **starred** entry (reviews.length desc), tiebreak by latest overallRating desc; show name, restaurant · category, quote, Taste/Value/Consistency breakdown, and "tried N times" subtitle; purple stripe card. If no starred entries have reviews, card is hidden. |
| **Fresh off the fork** | 5 most recent entries by earliest non-null review.date; show flag, name, date formatted "Mon D, YYYY"; clicking a row opens entry modal |
| **About** | Static section. Full-width `<Card>` with large `"Food Ranking"` watermark (`fontSize: '10rem'`, `opacity: 0.04`, `position: 'absolute'`, bottom-anchored, centered via `left: 50% / translateX(-50%)`). Two-column layout (`display: 'flex'`, `gap: '3rem'`, `padding: '2rem'`): left column (`flex: '0 0 60%'`) has ABOUT kicker (`kickerStyle`), "Why I built this" heading, two lorem ipsum body paragraphs (`color: var(--ink-mute)`); right column (`flex: '0 0 40%'`) has entry count (`entries.length`) in `var(--accent)` mono 3.5rem, "foods logged" label, thin horizontal rule, "est. 2025" mono label. No new API calls — uses existing `entries` array. |

Note: Top Tables, Regulars, Logging Pace, and Best Value Spot sections were removed from the home dashboard. Similar insights are now in AnalyticsPage.

- **Scroll-driven podium reveal**: Hall of Fame and Hall of Shame share one `<Card>` wrapped in `<div ref={podiumCardRef}>`. `shameExpanded` boolean state (starts `false`) drives all transitions. A `scroll` event listener on `podiumCardRef.current.closest('main')` fires on each scroll event; when the card's vertical midpoint is above the container's midpoint `setShameExpanded(true)`, scrolling back reverses it. Each podium container uses CSS grid `0fr → 1fr` (`gridTemplateRows`) for layout-aware height collapse with no dead space. Individual bars animate via `transform: scaleY(0↔1)` — Fame uses `transformOrigin: 'bottom'` (bars grow upward from divider), Shame uses `transformOrigin: 'top'` (bars grow downward); bars stagger 80ms apart left-to-right on expand, right-to-left on collapse (800ms spring `cubic-bezier(0.34, 1.2, 0.64, 1)`). Bar content (rank, category, restaurant, count, quote) fades in with `translateY` slide 200ms after its bar starts (600ms duration on appear, 300ms on collapse). Watermark titles split into per-character `<span>`s: letters animate `opacity + translateY` with 60ms stagger and 150ms initial offset on appear (500ms/letter, `cubic-bezier(0.34, 1.1, 0.64, 1)`), reverse stagger on disappear.
- **Sidebar**: primary nav (Home, Entries, Rankings) + EXPLORE section (Categories, Restaurants, Analytics). Footer shows entry count, restaurant count, starred count, and "est. 2025".
- **Scope filters on Entries**: Everything / ★ Starred / Abroad / Home / Try Again / Never Again / Uncertain. Sort pills: Most recent / Top rated / A–Z. All seven pills share one active state; Uncertain checks latest review's `uncertainRating` only.

### Environment

Copy `server/.env.example` to `server/.env` and fill in:
```
DATABASE_URL="postgresql://user:password@localhost:5432/food_ranking?schema=public"
PORT=3000
CLIENT_URL=http://localhost:5173
```

Run `npm run db:migrate` after setting up PostgreSQL to create the database tables.

## Hosting & Auth

**Two databases** (both on Railway Postgres):
- `DATABASE_URL` — real DB, password-protected
- `DEMO_DATABASE_URL` — demo DB, pre-seeded snapshot, nightly reset via `--clear` import script

**Prisma singleton** (`src/lib/prisma.ts`) will need to support two clients — one per database URL — swapped per-request based on auth state rather than at module load time.

**Auth middleware** (planned in `server/src/index.ts`):
- Basic Auth over HTTPS; password from env var
- IP-based lockout: 5 failed attempts → 15-minute cooldown, tracked in an in-memory counter (resets on server restart — acceptable for personal use)
- Middleware attaches the correct Prisma client to `res.locals` based on whether the request is authenticated (real DB) or in demo mode (demo DB)

**Capacitor app**: credentials baked in as a build-time env variable; the app sends them automatically on every request — no login screen is ever shown.

**Web login page**: two options — enter password (real DB) or Try the Demo (demo DB). Demo mode toggle also available somewhere in the app UI (e.g. sidebar footer) for showing the app in person.

## Code review effort

Default to low or medium effort unless the task is explicitly complex. Only use high effort for architecture decisions or difficult debugging.