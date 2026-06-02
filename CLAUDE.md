# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| GET | `/api/rankings` | All entries grouped by category; sorted by `manualRank` asc (nulls last), then `overallRating` desc. Includes `flag` and `manualRank` per entry. |
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
    home/
      HomePage.tsx      # / — dashboard: greeting, stat grid, top 5 podium, Hall of Fame/Shame, Reigning Champion, Fresh off the fork, Top Tables, Regulars, Logging pace, Best value
    entries/
      EntryList.tsx     # /entries — card list + search + scope filters (Everything/Starred/Abroad/Home) + sort pills (Most recent/Top rated/A-Z)
      EntryCard.tsx     # card: flag SVG, name, category, restaurant, avg overallRating; gold styling when starred
      EntryForm.tsx     # /entries/new — form + live dupe detection (list format) + FlagPicker + category combo box
      EntryDetail.tsx   # /entries/:id — entry info + inline editing + star toggle + reviews list + ReviewForm + delete entry/review; fully dark themed
      EntryModal.tsx    # modal wrapper around EntryDetail; onClose navigates back
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency (1–10) + date + notes + retroactive checkbox
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category, drag-and-drop reorder via @dnd-kit (gated behind Edit Rankings mode)
    categories/
      CategoriesPage.tsx  # /categories — accordion list, inline rename, delete (blocked if entries exist)
    restaurants/
      RestaurantsPage.tsx # /restaurants — accordion list, inline rename, delete (blocked if entries exist)
  context/
    ToastContext.tsx    # ToastProvider + useToast() hook; showToast(message, variant?)
  types.ts              # Entry, EntryDetail, Review (includes retroactive), RankedEntry, Rankings, CategorySummary, RestaurantSummary
  App.tsx               # routes + React Router background-location modal pattern for /entries/:id
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
- **Rankings drag-and-drop**: gated behind "Edit Rankings" button. Save persists order via `PATCH /api/rankings/reorder`; Cancel restores snapshot.
- **Category combo box**: on new entry form, shows existing categories as dropdown, allows free-text new category.
- **Home dashboard**: stat grid, top 5 podium, Hall of Fame/Shame, Reigning Champion, Fresh off the fork, Top Tables, Regulars, Logging pace bar chart, Best value. All computed client-side from cached `['entries']` query. Date-dependent sections (Logging pace, Fresh off the fork) use the earliest non-null `review.date` per entry — entries with no dated reviews are excluded from pace and sorted last in recency.
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

## Status

- [x] Server scaffolded, type-checks clean (`npx tsc --noEmit`)
- [x] PostgreSQL running, `food_ranking` database created, migrations applied
- [x] API routes implemented (entries CRUD + PATCH, reviews CRUD, rankings, search)
- [x] React frontend scaffolded and functional, type-checks clean
- [x] Bulk import script — 497 entries and 494 reviews seeded
- [x] Starred entry gold card styling + toggle on detail page
- [x] Inline review editing (PUT /api/reviews/:id)
- [x] Rankings show all entries (unrated below rated)
- [x] Edit existing entries (foodName, category, flag, restaurant name — inline on detail page)
- [x] Categories sidebar tab (/categories) — list, filter, rename, delete
- [x] Restaurants sidebar tab (/restaurants) — list, filter, rename, delete
- [x] Country flag support — `Entry.flag` ISO code, SVG rendering via FlagImage, FlagPicker for input
- [x] Entry detail opens as modal overlay (React Router background-location pattern); direct URL still works as full page
- [x] Rankings drag-and-drop reorder per category (`Entry.manualRank`, `@dnd-kit`, `PATCH /api/rankings/reorder`)
- [x] Rankings edit mode — drag gated behind Edit Rankings button; Save/Cancel flow
- [x] Delete entries, reviews, categories, restaurants with confirmation and warnings
- [x] Toast notifications + query invalidation for immediate UI updates without refresh
- [x] Category combo box on new entry form (existing categories + free-text new)
- [x] Duplicate warnings shown as readable list
- [x] Star button prominent on entry modal
- [x] Ube Midnight redesign — design tokens, typography, nav restructure, scope filters on Entries
- [x] Full dark theme — all modals, dropdowns, inputs, FlagPicker themed with CSS variables
- [x] Home dashboard — stat grid, podium, Hall of Fame/Shame, Top Tables, Regulars, Logging pace
- [x] Home dashboard date fix — Logging pace and Fresh off the fork use review.date, not createdAt
- [x] Review.retroactive flag — checkbox on form, badge on review card, persisted via POST/PUT reviews
- [x] Weighted overallRating — Taste 60%, Consistency 30%, Value 10%; weights redistributed for partial ratings
- [ ] Capacitor mobile wrapper