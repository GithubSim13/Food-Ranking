# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Client** (`/client`): React + Vite (TypeScript), TanStack Query, React Router v6, axios
- **Server** (`/server`): Node.js + Express (TypeScript) + Prisma ORM
- **Database**: PostgreSQL 17, local, port 5432, db `food_ranking`
- **Mobile**: Capacitor (planned)

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
npx ts-node src/scripts/import.ts <path-to-entries.md>
```
Safe to re-run: upserts entries, backfills reviews for entries that have none yet.
**Important:** The script calls `dotenv.config()` before importing PrismaClient — this order is required because Prisma reads `DATABASE_URL` at import time. Run from the `/server` directory so `.env` is resolved correctly.

## Architecture

### Data model (`server/prisma/schema.prisma`)

```
Restaurant ──< Entry ──< Review
```

- **Restaurant** — `id`, `name`
- **Entry** — `id`, `foodName`, `category`, `restaurantId`, `starred` (bool), `createdAt`, `updatedAt`
- **Review** — `id`, `entryId`, `date?` (DateTime, nullable), `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `createdAt`

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
| POST | `/api/entries` | Create entry — body: `{ foodName, category, restaurantName, starred? }`. Find-or-creates restaurant. |
| PATCH | `/api/entries/:id` | Partial update — body: `{ starred?, foodName?, category? }`. Only provided fields are written. |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search (ILIKE) for duplicate detection |
| POST | `/api/reviews` | Create review — body: `{ entryId, date?, rating1?, rating2?, rating3?, notes? }`. `overallRating` is computed server-side; client value is ignored. |
| PUT | `/api/reviews/:id` | Update review — same optional fields as POST. `overallRating` recomputed server-side. |
| GET | `/api/rankings` | All entries grouped by category; rated entries sorted by avg `overallRating` desc, unrated entries at bottom of each group sorted alphabetically. |

#### overallRating computation (server-enforced)
`overallRating` is always the average of whichever of `rating1`, `rating2`, `rating3` are non-null. If all three are null, `overallRating` is null. Clients must never send `overallRating` — it is always overwritten.

### Client structure

```
client/src/
  api/
    entries.ts          # getEntries, getEntry, searchEntries, createEntry, patchEntry
    reviews.ts          # createReview, updateReview
    rankings.ts         # getRankings
  components/
    layout/
      AppShell.tsx      # sidebar nav + Outlet
    entries/
      EntryList.tsx     # /entries — card list + client-side search
      EntryCard.tsx     # card: name, category, restaurant, avg overallRating; gold styling when starred
      EntryForm.tsx     # /entries/new — form + live dupe detection (debounced 300ms)
      EntryDetail.tsx   # /entries/:id — entry info + star toggle + reviews list + ReviewForm
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency (1–10) + date + notes
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category, sorted by avg rating
  types.ts              # Entry, EntryDetail, Review, RankedEntry, Rankings
  App.tsx               # routes: / → /entries, /entries, /entries/new, /entries/:id, /rankings
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
- [ ] Edit existing entries (foodName, category, restaurant)
- [ ] Capacitor mobile wrapper
