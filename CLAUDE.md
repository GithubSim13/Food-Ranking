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
- **Review** — `id`, `entryId`, `date?` (DateTime, nullable), `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `createdAt`

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
| GET | `/api/entries` | All entries, newest first; includes `reviews: [{ overallRating }]` for avg calculation |
| GET | `/api/entries/:id` | Single entry with full restaurant + reviews, ordered by `createdAt` asc |
| POST | `/api/entries` | Create entry — body: `{ foodName, category, restaurantName, starred?, flag? }`. Find-or-creates restaurant. |
| PATCH | `/api/entries/:id` | Partial update — body: `{ starred?, foodName?, category?, flag? }`. Only provided fields are written. |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search (ILIKE) for duplicate detection |
| POST | `/api/reviews` | Create review — body: `{ entryId, date?, rating1?, rating2?, rating3?, notes? }`. `overallRating` is computed server-side; client value is ignored. |
| PUT | `/api/reviews/:id` | Update review — same optional fields as POST. `overallRating` recomputed server-side. |
| GET | `/api/rankings` | All entries grouped by category; within each category, entries sorted by `manualRank` asc (nulls last), then by avg `overallRating` desc as tiebreaker. Includes `flag` and `manualRank` per entry. |
| PATCH | `/api/rankings/reorder` | Persist drag-and-drop order — body: `{ category: string, orderedIds: number[] }`. Writes `manualRank` (0-based index) to each entry in the list. |
| GET | `/api/categories` | Distinct categories with entry count — `[{ name, entryCount }]`, sorted alphabetically. |
| PATCH | `/api/categories/:name` | Rename a category — body: `{ name: string }`. Bulk-updates all entries via `updateMany`. `:name` is URL-encoded. |
| GET | `/api/restaurants` | All restaurants with entry count — `[{ id, name, entryCount }]`, sorted alphabetically. |
| PATCH | `/api/restaurants/:id` | Edit restaurant name — body: `{ name: string }`. |

#### overallRating computation (server-enforced)
`overallRating` is always the average of whichever of `rating1`, `rating2`, `rating3` are non-null. If all three are null, `overallRating` is null. Clients must never send `overallRating` — it is always overwritten.

### Client structure

```
client/src/
  api/
    entries.ts          # getEntries, getEntry, searchEntries, createEntry, patchEntry
    reviews.ts          # createReview, updateReview
    rankings.ts         # getRankings, reorderCategory
    restaurants.ts      # getRestaurants, patchRestaurant
    categories.ts       # getCategories, renameCategory
  components/
    layout/
      AppShell.tsx      # sidebar nav (Entries, Rankings, Categories, Restaurants) + Outlet
    common/
      Modal.tsx         # reusable modal overlay: backdrop + scrollable card, ESC/backdrop to close
      FlagImage.tsx     # renders SVG flag from country-flag-icons; null → nothing, unknown code → text fallback
      FlagPicker.tsx    # searchable country dropdown; props: { value: string | null, onChange }
      countryList.ts    # static list of 250 { code, name } pairs (auto-generated, do not hand-edit)
    entries/
      EntryList.tsx     # /entries — card list + client-side search; card click opens EntryModal
      EntryCard.tsx     # card: flag SVG, name, category, restaurant, avg overallRating; gold styling when starred
      EntryForm.tsx     # /entries/new — form + live dupe detection + FlagPicker
      EntryDetail.tsx   # /entries/:id — entry info + inline editing (foodName, category, flag, restaurant) + star toggle + reviews list + ReviewForm
      EntryModal.tsx    # modal wrapper around EntryDetail; onClose navigates back
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency (1–10) + date + notes
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category, drag-and-drop reorder via @dnd-kit, shows flag SVGs
    categories/
      CategoriesPage.tsx  # /categories — list categories with counts, click to expand entries, inline rename
    restaurants/
      RestaurantsPage.tsx # /restaurants — list restaurants with counts, click to expand entries, inline rename
  types.ts              # Entry, EntryDetail, Review, RankedEntry, Rankings, CategorySummary, RestaurantSummary
  App.tsx               # routes + React Router background-location modal pattern for /entries/:id
  main.tsx              # QueryClientProvider + BrowserRouter
```

### Key behaviours

- **Vite proxy**: `/api` → `http://localhost:3000`
- **Dupe detection**: debounced 300ms on foodName input (>2 chars), calls `GET /api/entries/search?q=`, shows amber inline warning with matches
- **Avg rating on cards**: computed client-side from `reviews[].overallRating` (null values excluded); displayed as `toFixed(2)`, shows "Unrated" when null
- **Review invalidation**: after POST /api/reviews or PUT /api/reviews/:id, `['entries', entryId]` query is invalidated to refresh the detail page
- **Starred entries**: gold card styling (amber border, warm background, box shadow) on entry list and rankings; toggle button on entry detail page uses optimistic update via TanStack Query
- **Review notes**: stored as newline-separated text; rendered as `<ul><li>` bullet list (split on `\n`, empty lines skipped)
- **Inline review editing**: each review card on `/entries/:id` has an Edit button that switches to an inline form pre-filled with existing values; saves via PUT /api/reviews/:id
- **Inline entry editing**: "Edit" button on `/entries/:id` shows a form to edit foodName, category, flag (via FlagPicker), and restaurant name. Restaurant renames call PATCH /api/restaurants/:id; other fields call PATCH /api/entries/:id. Both fire in parallel if both changed.
- **Flag display**: `FlagImage` component renders the SVG flag from `country-flag-icons/react/3x2` wherever a flag is shown (EntryCard, EntryDetail header, RankingsPage, CategoriesPage expanded list, RestaurantsPage expanded list). Falls back to raw text for unknown codes; renders nothing for null.
- **FlagPicker**: searchable dropdown — type country name or ISO code to filter 250 countries. Shows SVG flag + name + code in results. "✕ No flag (local)" clears to null. Arrow-key navigation, Enter to select, Escape to close, click-outside to dismiss.
- **Entry detail modal**: clicking an entry card anywhere in the app opens `EntryDetail` inside `Modal.tsx` as an overlay. URL updates to `/entries/:id` (React Router background-location pattern). ESC or backdrop click closes and returns to the previous page. Direct navigation to `/entries/:id` still renders `EntryDetail` as a full page.
- **Rankings drag-and-drop**: on `/rankings`, each category's entries are reorderable via `@dnd-kit`. All entries (rated and unrated) are draggable. Drag order is persisted to `Entry.manualRank` via `PATCH /api/rankings/reorder`. Rated entries are not locked — the user's manual order takes precedence. `overallRating` is shown as a secondary label, not as a sort enforcer.
- **Categories page**: accordion list — clicking a category reveals its entries inline. Rename button enters inline edit mode (Enter to save, Escape to cancel); calls PATCH /api/categories/:name which bulk-updates all entries.
- **Restaurants page**: same pattern keyed by restaurant ID; rename calls PATCH /api/restaurants/:id.

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
- [x] Categories sidebar tab (/categories) — list, filter, rename
- [x] Restaurants sidebar tab (/restaurants) — list, filter, rename
- [x] Country flag support — `Entry.flag` ISO code, SVG rendering via FlagImage, FlagPicker for input
- [x] Entry detail opens as modal overlay (React Router background-location pattern); direct URL still works as full page
- [ ] Rankings drag-and-drop reorder per category (`Entry.manualRank`, `@dnd-kit`, `PATCH /api/rankings/reorder`)
- [ ] Capacitor mobile wrapper