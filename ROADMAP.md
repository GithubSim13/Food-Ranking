# ROADMAP.md

Planned features, in-progress work, and completed feature history.

---

## In Progress

- [ ] Capacitor mobile wrapper

---

## Planned

### 1. Review Images

- Separate `ReviewImage` table:

  ```
  ReviewImage — id, reviewId, url, caption?, sortOrder, createdAt
  ```
- **Storage**: Cloudflare R2 (free tier: 10GB + 10M reads/month — effectively free for personal use)
- Flow: image uploaded to R2 → URL stored in `ReviewImage`
- Raw image bytes never stored in PostgreSQL

### 2. Map View

**Concept**
- Default view: all reviewed restaurants near current location, pinned by rating
- Filtered view: narrow by category/food type pills (Breakfast, Dessert, Coffee, Chicken, etc.)
- Only reviewed restaurants shown — no unreviewed noise
- Pin popup: restaurant name, top rated dish, your rating, link to entry

**Tech**
- Mapbox GL JS (web SDK, works in Capacitor WebView)
- `@capacitor/geolocation` for native location on mobile
- External Places API for real-world branch locations (Google Places vs Mapbox TBD)
- Cross-reference restaurant names in DB against Places API results for nearby branches

**Schema addition**
```
Restaurant — id, name, googlePlaceId?, mapboxId?
```
- Nullable — null means restaurant doesn't appear on map yet
- New entries: link Places ID at creation time
- Existing entries: backfill gradually, no rush

### 3. Hosting & Auth

**Deployment prerequisite — duplicate Restaurant cleanup**
Before running `migrate deploy` on any new environment (prod or demo DB), check for and clean up duplicate `Restaurant` rows. Migration `20260619000000_restaurant_name_unique` adds a `@unique` constraint on `Restaurant.name` and will fail if duplicates exist. Cleanup steps: for each duplicate group, reassign all entries from the duplicate row(s) onto the canonical row via `entry.updateMany`, delete the duplicate `Restaurant` row(s), then run `migrate deploy`.

**Infrastructure**
- **Frontend** → Vercel
- **Backend + DB** → Railway

**Two Railway Postgres databases**
- **Real DB** — your data, password-protected
- **Demo DB** — pre-seeded snapshot of real data, writable by anyone, resets automatically on a nightly cron using the existing `--clear` import script

**Auth model**
- Web visitors hit a login page with two options: enter password (real DB) or Try the Demo (demo DB)
- Capacitor app has credentials baked in as a build-time env variable — opens straight to real DB, no login screen ever shown
- Demo mode toggle somewhere in the app UI (e.g. sidebar footer) for showing the app to people in person without risking real data

**Server middleware**
- Basic Auth over HTTPS — password configured via env var
- IP-based failed-attempt lockout: 5 failures → 15-minute cooldown, in-memory counter (resets on server restart, acceptable for personal use)
- Request middleware swaps Prisma client instance based on whether the user is authenticated (real DB) or in demo mode (demo DB)


---

## Shelved

Ideas documented for later, not currently prioritised:

- **Rating history chart** — per-entry line chart of overallRating over time (+ T/V/C toggleable); part of a broader analytics push; uses existing recharts
- **Shareable entry cards** — generate a pretty image card (Spotify Wrapped style) for a single entry
- **Tags** — freeform tags on entries beyond category (e.g. "spicy", "late night"); filterable on Entries and Rankings
- **Budget tracker** — optional price is now on reviews. Remaining shelved work: avg spend per restaurant, best value per dollar analysis alongside Value rating
- **Move entries active category detection improvement** — attempted to fix sticky header `getBoundingClientRect` clamping issue via non-sticky sentinel divs; reverted due to sentinel divs interfering with move mode dimming logic. Current implementation requires scrolling slightly past a category header for it to register as active. Possible future fix: use IntersectionObserver instead of scroll listener + getBoundingClientRect.

---

## Open Questions

- Google Places vs Mapbox for external restaurant data
- Pin design — color/size by rating?
- Mobile UI for map filter pills
- **Mobile framework** — validate Capacitor + Mapbox GL JS map performance on a real device before committing; if sluggish, consider migrating frontend to React Native (`react-native-maps`)

---

## Completed

- [x] Initial setup — Express+Prisma server scaffolded, PostgreSQL running, migrations applied, 497 entries + 494 reviews seeded via bulk import
- [x] Core API — entries/reviews/rankings/categories/restaurants CRUD, search, weighted overallRating (Taste 60%, Consistency 30%, Value 10%)
- [x] React frontend — scaffolded, routing via React Router v6, type-checks clean
- [x] Starred entries — gold card styling, toggle on detail page
- [x] Inline review editing — PUT /api/reviews/:id, includes uncertainRating + price
- [x] Rankings — all entries (unrated below rated), drag-and-drop reorder (@dnd-kit, Edit Rankings mode), alphabetical categories
- [x] Entry editing — inline on detail page (foodName, category, flag, restaurant name)
- [x] Categories + Restaurants pages — list, search, rename, delete; sortable table redesigns
- [x] Country flag support — Entry.flag ISO code, FlagImage SVG rendering, FlagPicker input
- [x] Entry detail modal — React Router background-location pattern; direct URL still works
- [x] Delete flows — entries (+ reviews), individual reviews, categories, restaurants; confirmations + warnings
- [x] Toast notifications + query invalidation
- [x] Ube Midnight redesign — design tokens, dark theme throughout, CSS variables for all colors/fonts
- [x] Home dashboard — stat row, Hall of Fame/Shame podiums (scroll-driven, animated), Best of the Month, Fresh off the Fork, About section
- [x] Home dashboard data wiring — all sections computed from ['entries'] query, no new API calls
- [x] Review.uncertainRating — checkbox on forms ("Ratings added after the fact"), badge on cards, setAllRetroactive script
- [x] Rankings search + scope filters (Everything/Starred/Abroad/Home); Move Entries bulk reassignment
- [x] Entry flags — tryAgain/neverAgain XOR toggles; uncertainRating badge; EntryFlagBadges dots; filter pills on Entries page
- [x] Notepad importer — standalone HTML tool (gitignored) for bulk entry creation from raw notepad format
- [x] Category Comparison Panel — rated entries in same category, T/V/C breakdowns, hover popup with restaurant + notes
- [x] Category + Restaurant combo boxes on new entry form
- [x] Inline review on new entry form — optional toggle, RatingInput sliders, date auto-set to local date
- [x] React-side form validation — no native required; inline error messages; clamped rating inputs 0–10
- [x] RatingInput component — label + slider (red→yellow→green gradient) + number input; reused across all forms
- [x] Entries page card grid — responsive 3/2/1 columns; notes quote; badge dots; gold starred
- [x] Search extended to review notes — whole-word regex for notes, substring for other fields; priority-sorted results
- [x] SearchAndScopeBar — extracted reusable component; sticky; sets --search-bar-height via ResizeObserver for sticky category headers
- [x] Analytics page — /analytics; all sections from ['entries'] query; scroll-triggered animations (useInViewOnce + useCountUp); donut charts, top categories, best restaurants, most visited/logged, category insights, rating trajectory, logging activity calendar, scatter plots, long time no see, rating by country, underrated gems, starred picks; all paginated sections with prev/next + "Showing X–Y of Z"
- [x] Category Insights selector — replaced horizontal scroll pills with a compact combobox: search input + current category pill side by side; dropdown list appears on typing or pill click, collapses on selection or outside click
- [x] Quick Rate page — /rate; queue-based sub-rating; progress bar; CategoryComparisonPanel on right; unrated badge on nav link
- [x] Review price field — optional Float (₱) on Review; shown on cards and in CategoryComparisonPanel popup
- [x] Best of the Month — replaced Reigning Champion; current-month filter + all-time fallback; gold if starred
- [x] Error handling — try/catch on all 17 route handlers; entry detail 400/404 renders "Entry not found"
- [x] 404 page — NotFoundPage, Minecraft achievement style; SectionErrorBoundary on Home dashboard sections
- [x] Code audits — extracted shared utils, Icons, pageStyles, SearchAndScopeBar, CategoryComparisonPanel, EntryFlagBadges; removed dead code; CSS variable consistency
- [x] Performance + UI consistency pass — staleTime 5min, useMemo on derived values; standardized form/button/label sizes; transitions; focus-visible outline
- [x] QOL pass — tryAgain/neverAgain + price on EntryForm, consistent category/restaurant auto-suggest (combo boxes on EntryForm, datalist on EntryDetail + RankingsPage), textarea auto-resize on paste/load, Most Recent sort by review.createdAt
- [x] Rating Trajectory — hybrid list + detail chart; list shows all entries with 2+ rated reviews with delta badges; clicking a row reveals a single-entry Recharts line chart below; clicking again collapses it
- [x] Restaurant notes + card redesign — `Restaurant.notes` (nullable); PATCH accepts name + notes; RestaurantsPage rebuilt as a card grid (avatar, avg rating bar, notes block) with inline in-place edit (autoResize notes textarea) and full-width search + sort pills
- [x] Restaurants page redesign — replaced sortable table with masonry-style card grid (CSS columns); data-rich cards with a 3px top accent stripe (purple default, gold if the restaurant has a starred entry); avatar, name, entry count + starred count, avg rating bar, "top dish" mini-pill (highest-rated entry per restaurant), notes (when present); edit/delete icons top-right; expandable entry list per card with click-through to entry detail; restaurant notes field (String?, nullable) added to schema via migration add_restaurant_notes
- [x] Animation pass — shared keyframes/utility classes in `index.css` (`fadeSlideUp`/`fadeIn`/`scaleIn`, `.anim-*` entrance + `.anim-delay-1..8` stagger + `.anim-on-view`/`.is-visible` scroll-trigger + `.hover-lift`/`.hover-scale`, all CSS-variable-only and `prefers-reduced-motion` aware) plus `useInViewOnce(ref)` hook in `utils.ts`; applied tastefully across pages — staggered card/row entrances (Entries, Categories, Restaurants), scroll-triggered section reveals (Home non-podium sections, Rankings category headers), scale-in on Quick Rate card (keyed on entry id) + 404 copy, fade-in on Entry detail, hover-lift on entry/restaurant cards; existing PodiumSection/Analytics/Modal/Toast animations left untouched