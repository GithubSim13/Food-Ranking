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
npx ts-node src/scripts/setAllRetroactive.ts   # sets retroactive = true on all existing reviews (already run)
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
- **Entry** — `id`, `foodName`, `category`, `restaurantId`, `starred` (bool), `flag` (String?, nullable 2-letter ISO code), `manualRank` (Int?, nullable — per-category drag order), `createdAt`, `updatedAt`
- **Review** — `id`, `entryId`, `date?` (DateTime, nullable), `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `retroactive` (Boolean, default false), `createdAt`

`Entry.flag` is a nullable 2-letter ISO 3166-1 alpha-2 country code (e.g. `"SG"`, `"JP"`). `null` means the food was eaten locally (home country). Non-null means eaten abroad.

`Entry.manualRank` is a nullable integer used to persist drag-and-drop order within a category on the Rankings page. `null` means unranked (new entries). Lower value = higher position within the drag order tier.

`Review.retroactive` flags that ratings were added after the fact, not at time of eating. Shown as a badge on review cards.

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
| GET | `/api/entries` | All entries, newest first; includes `reviews: [{ overallRating, date }]` for avg and date calculations |
| GET | `/api/entries/:id` | Single entry with full restaurant + reviews, ordered by `createdAt` asc |
| POST | `/api/entries` | Create entry — body: `{ foodName, category, restaurantName, starred?, flag? }`. Find-or-creates restaurant. |
| PATCH | `/api/entries/:id` | Partial update — body: `{ starred?, foodName?, category?, flag? }`. Only provided fields are written. |
| DELETE | `/api/entries/:id` | Delete entry and all its reviews. |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search (ILIKE) for duplicate detection |
| POST | `/api/reviews` | Create review — body: `{ entryId, date?, rating1?, rating2?, rating3?, notes?, retroactive? }`. `overallRating` computed server-side. |
| PUT | `/api/reviews/:id` | Update review — same optional fields as POST including `retroactive?`. `overallRating` recomputed server-side. |
| DELETE | `/api/reviews/:id` | Delete a single review. |
| GET | `/api/rankings` | All entries grouped by category, alphabetically sorted by category name; within each category: rated entries by `overallRating` desc (latest review's), unrated by `manualRank` asc nulls last. Includes `flag` and `manualRank` per entry. |
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
      AppShell.tsx      # sidebar nav: Home, Entries, Rankings, then EXPLORE: Categories, Restaurants; footer shows entry count + avg rating
    common/
      Modal.tsx         # reusable modal overlay: dark themed, ESC/backdrop to close
      Toast.tsx         # single toast notification, auto-dismisses after 3s, success/error variants
      ToastContainer.tsx  # renders active toasts stacked in bottom-right
      FlagImage.tsx     # renders SVG flag from country-flag-icons; null → nothing, unknown code → text fallback
      FlagPicker.tsx    # searchable country dropdown, dark themed; props: { value: string | null, onChange }
      countryList.ts    # static list of 250 { code, name } pairs (auto-generated, do not hand-edit)
      Icons.tsx         # shared icon components: PencilIcon, TrashIcon, ChevronIcon, iconBtnStyle
      SectionErrorBoundary.tsx  # class-based React error boundary; wraps each Home dashboard section; shows "Could not load [title]" fallback on error
    NotFoundPage.tsx    # catch-all 404 page — Minecraft "How did we get here?" achievement toast, bounces in from top with idle bob animation, ghost 404 background text, Go Home button; matched by <Route path="*"> in App.tsx
    home/
      HomePage.tsx      # / — dashboard: greeting, stat grid, top 5 podium, Hall of Fame/Shame, Reigning Champion, Fresh off the fork, Top Tables, Regulars, Logging pace, Best value
    entries/
      EntryList.tsx     # /entries — responsive card grid (3 columns desktop, 2 tablet, 1 mobile) + search + scope filters (Everything/Starred/Abroad/Home) + sort pills (Most recent/Top rated/A-Z)
      EntryCard.tsx     # card: flag SVG + food name + quote (first line of latest review notes, 2-line clamp, omitted if no notes) + category · restaurant + rating pinned bottom right; gold styling when starred
      EntryForm.tsx     # /entries/new — form + live dupe detection (list format) + FlagPicker + category combo box + restaurant combo box (fetches GET /api/restaurants) + optional inline review section (toggle, RatingInput for Taste/Value/Consistency, Notes, date auto-set to ISO timestamp at POST time) + Category Comparison Panel when review section is open + React-side validation (no native HTML validation)
      EntryDetail.tsx   # /entries/:id — entry info + inline editing + star toggle + reviews list + ReviewForm + delete entry/review; fully dark themed
      EntryModal.tsx    # modal wrapper around EntryDetail; onClose navigates back
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency via RatingInput component + date + notes + retroactive checkbox; rating inputs also clamped in edit form
      RatingInput.tsx   # reusable rating field: label (left) + range slider (full red→yellow→green spectrum gradient, 6px track) + number input (right, 70px fixed width); fully synced bidirectionally; clamped 0–10 on onChange; step="any" for decimal precision; used in all review add/edit forms
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category alphabetically; rated entries sorted by overallRating desc (automatic); unrated entries below, drag-and-drop reorder via @dnd-kit (gated behind Edit Rankings mode); search bar + scope filters (Everything/Starred/Abroad/Home); reads ?category= URL param on mount to pre-fill search bar (used by CategoriesPage card clicks)
    categories/
      CategoriesPage.tsx  # /categories — searchable card grid (4 columns); each card shows category name, entry count, avg overallRating (color-coded); pencil/trash icon buttons; clicking a card navigates to /rankings?category=<name> which pre-fills the Rankings search bar
    restaurants/
      RestaurantsPage.tsx # /restaurants — searchable list; each row shows restaurant name, entry count badge, avg overallRating badge, pencil/trash icon buttons; click to expand and show entries (food name + category, indented); collapsed by default
  context/
    ToastContext.tsx    # ToastProvider + useToast() hook; showToast(message, variant?)
  types.ts              # Entry, EntryDetail, Review (includes retroactive), RankedEntry, Rankings, CategorySummary, RestaurantSummary
  utils.ts              # shared helpers: sortReviewsByDateDesc, latestRating, latestRatedReview, scoreColor
  pageStyles.ts         # shared inline style objects: kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle, smallDeleteBtnStyle
  App.tsx               # routes + React Router background-location modal pattern for /entries/:id; catch-all <Route path="*"> renders NotFoundPage
  main.tsx              # QueryClientProvider + BrowserRouter + ToastProvider + ToastContainer
```

### Key behaviours

- **Vite proxy**: `/api` → `http://localhost:3000`
- **Design system**: Ube Midnight dark palette — CSS variables (`--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-mute`, `--line`, `--accent`, `--gold`, etc.) in `index.css`. Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), Space Mono (mono). All modals, dropdowns, inputs, and buttons use CSS variables — no hardcoded light colors anywhere.
- **Dupe detection**: debounced 300ms on foodName input (>2 chars), calls `GET /api/entries/search?q=`, shows matches as a readable list (name, restaurant, category per item)
- **Avg rating on cards**: computed client-side from `reviews[].overallRating` (null values excluded); displayed as `toFixed(2)`, shows "Unrated" when null
- **Toast notifications**: all mutations show a success or error toast via `useToast()` from `ToastContext`
- **Query invalidation**: after any mutation, relevant TanStack Query keys invalidated for immediate UI update — `['entries']`, `['entries', id]`, `['rankings']`, `['restaurants']`, `['categories']` as appropriate
- **Starred entries**: gold card styling on entry list and rankings; toggle button on entry detail page
- **Review notes**: stored as newline-separated text; rendered as `<ul><li>` bullet list
- **Retroactive reviews**: `Review.retroactive` boolean — when true, review card shows a small muted clock badge "ratings added later". Checkbox in both new and edit review forms.
- **Inline review editing**: Edit button on each review card; saves via PUT /api/reviews/:id; includes retroactive checkbox
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
- **Category Comparison Panel**: visible on entry detail when a review form is open (new or edit). Shows other rated entries in the same category sorted by `overallRating` desc. Displays food name, overallRating, and Taste/Value/Consistency breakdowns (— if null). Unrated entries hidden. Panel appears to the right; modal expands wider to accommodate it.
- **Category combo box**: on new entry form, shows existing categories as dropdown, allows free-text new category.
- **Restaurant combo box**: on new entry form, mirrors category combo box — fetches from GET /api/restaurants, shows existing names, allows free-text new restaurant.
- **Form validation**: all forms use React-side validation — no native HTML `required` attributes anywhere. Invalid fields show inline error messages below the field (danger CSS variable color, Hanken Grotesk, ~0.85rem); errors clear on input change.
- **Rating inputs (RatingInput component)**: reusable `RatingInput` component used across all review forms. Layout: label left, slider middle (fills remaining width), number input right (fixed ~70px). Slider track is always a full red → yellow → green spectrum gradient (`linear-gradient(to right, #e74c3c, #f39c12, #2ecc71)`), 6px height, white thumb. Slider and number input fully synced. Clamped 0–10 on `onChange` for both. `step="any"` on number input, `step="0.01"` on slider. Empty (null) = slider sits at 0 visually but does not write a value until user interacts.
- **Home dashboard**: all sections computed client-side from the cached `['entries']` query — do not add new API calls. Date-dependent sections (Logging pace, Fresh off the fork) use the earliest non-null `review.date` per entry — entries with no dated reviews are excluded from pace and sorted last in recency.

### Home dashboard sections (HomePage.tsx)

Layout rebuilt in Session 1 with placeholder values. Session 2 wires real data — **do not change any styling or layout, only replace hardcoded values**.

Sections (top to bottom) and how to compute each:

| Section | Computation |
|---------|-------------|
| **Greeting** | Total entry count, distinct category count |
| **Stat row** | Avg overallRating across all rated entries; total entries; count where `starred === true`; distinct restaurant count |
| **Top 5 podium** | Top 5 entries by highest overallRating (latest review per entry); all 5 shown as bars — order left to right: 4, 2, 1, 3, 5; bar heights: #1=65%, #2=50%, #3=40%, #4=28%, #5=18%; above each bar: entry name + score; inside bars 1–3: trophy emoji (🥇🥈🥉), rank number, category, restaurant name, review count; inside bars 4–5: medal emoji (🏅) and rank number only (too short for detail); clicking any bar opens entry modal via background-location pattern |
| **⭐ Starred Picks** | Top 5 starred entries () sorted by overallRating desc; list format — rank, flag, name, overallRating; green left border card; label "⭐ STARRED PICKS" |
| **💀 Hall of Shame** | Bottom 5 rated entries (min one review) sorted by overallRating asc; list format — rank, flag, name, overallRating; orange left border card; label "💀 HALL OF SHAME" |
| **Reigning Champion** | Most-reviewed **starred** entry (reviews.length desc), tiebreak by latest overallRating desc; show name, restaurant · category, quote, Taste/Value/Consistency breakdown, and "tried N times" subtitle; purple stripe card. If no starred entries have reviews, card is hidden. |
| **Fresh off the fork** | 5 most recent entries by review.date (earliest non-null per entry); show flag, name, date formatted "Mon D, YYYY" |
| **Top Tables** | Restaurants with ≥ 2 rated entries, sorted by avg overallRating desc; show rank, name, visit count (e.g. `3×`), avg overallRating |
| **Regulars** | Restaurants sorted by entry count desc; show rank, name, visit count + avg overallRating (e.g. `3× avg 8.6`) |
| **Logging Pace** | Avg entries per month across all months with data; bar chart one bar per calendar month using actual review dates; peak month bar highlighted purple; subtitle "Busiest was [Mon 'YY] ([N] foods) · [X]-month streak" |
| **Best Value Spot** | Restaurant with highest avg rating2 (Value score), min 2 entries; left side: label, avg Value score, name, subtitle; right side: list of that restaurant's entries with individual rating2 scores |

- **Sidebar**: primary nav (Home, Entries, Rankings) + EXPLORE section (Categories, Restaurants). Footer shows total foods rated + avg rating.
- **Scope filters on Entries**: Everything / ★ Starred / Abroad / Home. Sort pills: Most recent / Top rated / A–Z.

### Environment

Copy `server/.env.example` to `server/.env` and fill in:
```
DATABASE_URL="postgresql://user:password@localhost:5432/food_ranking?schema=public"
PORT=3000
CLIENT_URL=http://localhost:5173
```

Run `npm run db:migrate` after setting up PostgreSQL to create the database tables.

## Code review effort

Default to low or medium effort unless the task is explicitly complex. Only use high effort for architecture decisions or difficult debugging.