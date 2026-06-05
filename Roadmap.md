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
- **Budget tracker** — optional price field on reviews; avg spend per restaurant, best value per dollar alongside Value rating

---

## Open Questions

- Google Places vs Mapbox for external restaurant data
- Pin design — color/size by rating?
- Mobile UI for map filter pills
- **Mobile framework** — validate Capacitor + Mapbox GL JS map performance on a real device before committing; if sluggish, consider migrating frontend to React Native (`react-native-maps`)

---

## Completed

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
- [x] Review.uncertainRating flag (renamed from retroactive) — checkbox on form, badge on review card, persisted via POST/PUT reviews
- [x] Weighted overallRating — Taste 60%, Consistency 30%, Value 10%; weights redistributed for partial ratings
- [x] Codebase audit — dead code, redundancy, type safety gaps, CSS variable consistency
- [x] setAllRetroactive script — all 494 imported reviews marked uncertainRating = true
- [x] Rankings sorting — rated entries auto-sort by overallRating desc; drag-and-drop restricted to unrated entries only
- [x] Rankings search + scope filters (Everything / Starred / Abroad / Home) — category groups hidden when no matches
- [x] Category Comparison Panel — shown on entry detail when review form is open; rated entries in same category sorted by overallRating desc; Taste/Value/Consistency breakdowns displayed
- [x] Home dashboard layout rebuilt (Session 1) — new section order, stat row compacted to 4 cards, Reigning Champion card, Best Value split card, Logging Pace bar chart; all placeholder values
- [x] Home dashboard data wiring (Session 2) — all sections wired to real computed data from ['entries'] query; no new API calls
- [x] Home dashboard interactivity — ALL RANKINGS/ALL ENTRIES links, podium bars, Hall of Fame/Shame, Reigning Champion, Fresh off the fork rows all navigate correctly; entry clicks use background-location modal pattern
- [x] Home dashboard podium — all 5 entries shown as bars (order: 4,2,1,3,5); bars 1–3 show trophy + category + restaurant + review count inside; bars 4–5 show medal + rank only; Best Value split card with entry list on right
- [x] Home dashboard analytics logic — Hall of Fame → "⭐ Starred Picks" (top 5 starred by overallRating desc, list format); Hall of Shame → "💀 Hall of Shame" (bottom 5 rated, list format); Reigning Champion → most reviewed entry (reviews.length desc, tiebreak overallRating), shows "tried N times"
- [x] Scrollbar theming — custom dark scrollbars globally in index.css (6px, purple thumb #3a2f5e, hover #6c47d4, track #1c1826); Firefox + Chromium
- [x] Entries page filter layout — scope pills and sort pills aligned on same row via flex justify-content: space-between
- [x] Modal backdrop close fix — uses onMouseDown/onMouseUp pair with a ref; modal content has stopPropagation on onMouseDown; prevents close when click-dragging to select text
- [x] Review edit textarea auto-height — Notes textarea auto-resizes to content on edit open and on change; overflow hidden to prevent scrollbar flicker
- [x] Cache invalidation fix — onReviewUpdated in EntryDetail.tsx now invalidates both ['entries'] and ['rankings']; all other mutations in EntryDetail audited for same
- [x] Sticky search bar — SearchAndScopeBar uses position: sticky, top: -<main-padding>, paddingTop: <main-padding> to cover the scroll container's padding gap; opaque background, border-bottom, box-shadow for visual separation
- [x] Sticky category headers on Rankings — CategorySection headers use position: sticky with top set via CSS variable --search-bar-height; SearchAndScopeBar sets --search-bar-height on :root via ResizeObserver
- [x] Rankings categories sorted alphabetically — GET /api/rankings sorts category keys case-insensitively before building response
- [x] Latest-review rating — all overallRating display (entry cards, rankings, sidebar footer, home dashboard) uses latest review's overallRating instead of averaging; latest = most recent non-null date, dateless only wins if sole review; implemented via latestRating() helper on client; GET /api/rankings also fixed server-side
- [x] Reigning Champion restricted to starred entries — most-reviewed starred entry wins; hidden if no starred entries have reviews
- [x] Dynamic time-based greeting — "Morning" / "Afternoon" / "Evening" based on current hour
- [x] Categories page redesign — searchable card grid with avg overallRating (color-coded), icon buttons (pencil/trash), clicking card navigates to /rankings?category=<name>
- [x] Restaurants page redesign — searchable list with entry count badge, avg overallRating badge, icon buttons, expandable rows showing entries (food name + category)
- [x] Rankings ?category= URL param — RankingsPage reads query param on mount and pre-fills search bar; used by category card navigation
- [x] Bug fix: Best Value Spot — now scans all reviews for most recent one with a non-null rating2 value, not just latest rated review
- [x] Bug fix: Category Comparison Panel T/V/C — each sub-rating now independently finds latest non-null value across all reviews
- [x] Bug fix: Rankings alphabetical order — client-side localeCompare sort added as guarantee regardless of server/cache insertion order
- [x] Client codebase audit — extracted shared utils.ts (rating helpers), Icons.tsx (icon components), pageStyles.ts (page title/button styles); removed duplicated helpers across 7 files; added useMemo optimisations in CategoriesPage and RestaurantsPage
- [x] Server codebase audit — extracted routeHelpers.ts (parseId, restaurantNameSelect); added try/catch to all 17 async handlers; all Prisma failures now return 500 instead of crashing
- [x] Entry detail error states — 400 and 404 from GET /api/entries/:id both render "Entry not found" with back button; no more infinite loading
- [x] Catch-all 404 page — NotFoundPage component; matched by <Route path="*"> in App.tsx
- [x] Error boundaries on Home dashboard — SectionErrorBoundary wraps all 9 sections independently
- [x] Personalized 404 page — Minecraft "How did we get here?" achievement toast, bounces in from top with idle bob animation, ghost 404 background text, Ube Midnight palette
- [x] Restaurant Name combo box on new entry form — mirrors Category combo box; fetches from GET /api/restaurants; existing names + free-text new
- [x] Inline review on new entry form — optional toggle (+ Add Review); Taste/Value/Consistency (0–10, step any, clamped), Notes; date auto-set to ISO timestamp at POST time; review saved after entry creation even if partial
- [x] Category Comparison Panel on new entry form — appears when review section is expanded and a category is typed; mirrors entry detail panel
- [x] Native HTML validation replaced app-wide — all forms use React-side validation; inline error messages styled with CSS danger variable, Hanken Grotesk, below each field; errors clear on input change
- [x] Rating input bounds clamping — Taste/Value/Consistency inputs clamped to 0–10 on onChange across new entry form and review add/edit forms in entry detail
- [x] RatingInput component — reusable label + slider + number input; full red→yellow→green spectrum gradient track; bidirectional sync; clamped 0–10; used across all review add/edit forms and new entry inline review
- [x] Entries page card grid redesign — replaced list rows with responsive 3/2/1 column card grid; each card shows quote (first line of latest review notes, 2-line clamp) with rating pinned to bottom right; starred gold styling preserved
- [x] Search extended to include review notes — whole-word regex matching for notes, substring for name/category/restaurant; applies to both Entries and Rankings pages
- [x] Priority-based search sorting — whole-word matches ranked above partial matches; sort pills disabled and greyed out during active search on Entries page; priority sort applies within each category group on Rankings
- [x] Hall of Fame / Hall of Shame podium redesign — replaced Top 5 Podium + Starred Picks list + Hall of Shame list with two mirrored podiums in a single card; Hall of Fame bars grow upward (purple), Hall of Shame bars grow downward (orange); large backdrop watermark titles with green/red glow via `.hall-title-fame` / `.hall-title-shame` CSS classes
- [x] Podium rank display — removed trophy/medal/skull emojis; replaced with scaled rank numbers (rank 1 → 2.2rem, 2 → 1.7rem, 3 → 1.35rem, 4 → 1.05rem, 5 → 0.9rem; weight 800) inside bars for both Hall of Fame and Hall of Shame
- [x] Scroll-driven podium reveal — Hall of Shame peeks at 90px on load and expands to full height as user scrolls down the home page; Hall of Fame collapses to a 60px bar-colour strip; implemented via scroll event listener on `closest('main')`, `podiumCardRef` on the wrapping div, `shameExpanded` boolean state driving `height`/`maxHeight` and `opacity` transitions (500ms ease-in-out)
- [x] Hall of Fame / Hall of Shame podium quotes — first line of latest review notes shown on ranks 1–3 bars (italic, muted, 2-line clamp)
- [x] Hall of Fame / Hall of Shame bar gradients — bars fade from solid at the peak to transparent at the divider (fame: top→bottom, shame: bottom→top)
- [x] Hall of Fame / Hall of Shame transition animation — full cinematic expand/collapse: bars grow from divider outward (transformOrigin: 'bottom' for fame, 'top' for shame), per-bar scaleY stagger (80ms apart, 800ms duration, spring easing), content text flows in with translateY after bar opens (200ms delay, 600ms duration), watermark title assembles letter-by-letter with 60ms per-character stagger (500ms per letter), reverse stagger on collapse. Grid 0fr→1fr trick for container height so no dead space below.
- [x] Entry flags — tryAgain, neverAgain (XOR toggles on entry detail), uncertainRating (derived from latest review); badge dots on entry cards; filter pills on Entries page
- [x] Head-to-Head via Category Comparison Panel — hovering an entry in the panel shows a popup with restaurant name and all notes from the latest review only (sortReviewsByDateDesc logic); T/V/C and review count not repeated in popup as they're already visible in the row
- [x] Code Audit — HomePage.tsx split 619→248 lines into HomeShared.tsx, PodiumSection.tsx, ReigningChampionCard.tsx, LoggingPaceCard.tsx, BestValueCard.tsx; EntryFlagBadges extracted to common/EntryFlagBadges.tsx (badge CSS variables --badge-try-again, --badge-never-again, --badge-uncertain added to :root); CSS variable pass (#9b8fc0→var(--ink-mute), #e6a817→var(--gold)); date formatting audit confirmed formatReviewDate() already consistent everywhere