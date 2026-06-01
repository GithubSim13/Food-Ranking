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

## Architecture

### Data model (`server/prisma/schema.prisma`)

```
Restaurant ──< Entry ──< Review
```

- **Restaurant** — `id`, `name`
- **Entry** — `id`, `foodName`, `category`, `restaurantId`, `starred` (bool), `createdAt`, `updatedAt`
- **Review** — `id`, `entryId`, `date`, `notes?`, `rating1?` (Taste), `rating2?` (Value), `rating3?` (Consistency), `overallRating?`, `createdAt`

The generated Prisma client lives at `server/src/generated/prisma/client.ts` (Prisma v6 TypeScript client). Always import via the singleton at `src/lib/prisma.ts`.

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
| GET | `/api/entries/:id` | Single entry with restaurant + full reviews, ordered by date desc |
| POST | `/api/entries` | Create entry — body: `{ foodName, category, restaurantName, starred? }`. Find-or-creates restaurant. |
| GET | `/api/entries/search?q=` | Case-insensitive foodName search (ILIKE) for duplicate detection |
| POST | `/api/reviews` | Create review — body: `{ entryId, date, rating1?, rating2?, rating3?, overallRating?, notes? }` |
| GET | `/api/rankings` | Entries with reviews, avg `overallRating` per entry, grouped by category, sorted by rating desc |

### Client structure

```
client/src/
  api/
    entries.ts          # getEntries, getEntry, searchEntries, createEntry
    reviews.ts          # createReview
    rankings.ts         # getRankings
  components/
    layout/
      AppShell.tsx      # sidebar nav + Outlet
    entries/
      EntryList.tsx     # /entries — card list + client-side search
      EntryCard.tsx     # card: name, category, restaurant, avg overallRating, ⭐ badge
      EntryForm.tsx     # /entries/new — form + live dupe detection (debounced 300ms)
      EntryDetail.tsx   # /entries/:id — entry info + reviews list + ReviewForm
    reviews/
      ReviewForm.tsx    # add review: Taste/Value/Consistency/Overall (1–10) + date + notes
    rankings/
      RankingsPage.tsx  # /rankings — grouped by category, sorted by avg rating
  types.ts              # Entry, EntryDetail, Review, RankedEntry, Rankings
  App.tsx               # routes: / → /entries, /entries, /entries/new, /entries/:id, /rankings
  main.tsx              # QueryClientProvider + BrowserRouter
```

### Key behaviours

- **Vite proxy**: `/api` → `http://localhost:3000`
- **Dupe detection**: debounced 300ms on foodName input (>2 chars), calls `GET /api/entries/search?q=`, shows amber inline warning with matches
- **Avg rating on cards**: computed client-side from `reviews[].overallRating` (null values excluded)
- **Review invalidation**: after POST /api/reviews, `['entries', entryId]` query is invalidated to refresh the detail page

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
- [x] PostgreSQL running, `food_ranking` database created, initial migration applied
- [x] API routes implemented (entries CRUD, reviews, rankings, search)
- [x] React frontend scaffolded and functional, type-checks clean
- [ ] UI and logic fixes (TBD)
- [ ] Edit existing entries
- [ ] Capacitor setup
