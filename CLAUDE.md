# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Client** (`/client`): React + Vite (TypeScript)
- **Server** (`/server`): Node.js + Express (TypeScript) + Prisma ORM
- **Database**: PostgreSQL
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
npm run dev       # ts-node-dev watch mode on http://localhost:3001
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

- **Restaurant** — a place to eat (name, cuisine, city, etc.)
- **Entry** — a specific dish at a restaurant (name, category, imageUrl)
- **Review** — a personal rating for a dish (rating: Float, notes, visitedAt)

Cascading deletes are set: deleting a Restaurant removes its Entries; deleting an Entry removes its Reviews.

The generated Prisma client lives at `server/src/generated/prisma/` (Prisma v6 TypeScript client). Import it from there in route handlers.

### Server structure

```
server/
  src/
    index.ts          # Express app entry point, CORS + JSON middleware
    generated/prisma/ # auto-generated Prisma client (do not edit)
  prisma/
    schema.prisma     # data model
    migrations/       # migration history
  prisma.config.ts    # Prisma v6 config (loads DATABASE_URL via dotenv)
  .env                # local env vars — copy from .env.example
```

### Environment

Copy `server/.env.example` to `server/.env` and fill in:
```
DATABASE_URL="postgresql://user:password@localhost:5432/food_ranking?schema=public"
PORT=3001
CLIENT_URL=http://localhost:5173
```

Run `npm run db:migrate` after setting up PostgreSQL to create the database tables.
