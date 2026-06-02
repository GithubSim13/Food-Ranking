/**
 * Bulk import script for food entries from the exported Google Docs markdown.
 *
 * Usage (from /server directory):
 *   npx ts-node src/scripts/import.ts <path-to-entries.md>
 *   npx ts-node src/scripts/import.ts <path-to-entries.md> --clear
 *
 * Safe to re-run: uses upsert on Restaurant and Entry (matched by foodName +
 * restaurantName + category). Will NOT duplicate entries on repeated runs.
 * Reviews are only created if no review already exists for that entry.
 *
 * --clear: Deletes all existing Review, Entry, and Restaurant records before
 *          importing (in FK-safe order: Reviews → Entries → Restaurants).
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../generated/prisma/client";
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Flag emoji decoding
//
// Flag emojis consist of two Regional Indicator letters (U+1F1E6–U+1F1FF).
// In UTF-8 each RI letter encodes as F0 9F 87 [A6–BF]. When those 4 bytes are
// misread as CP437 they produce:
//   F0 → ≡   (U+2261)
//   9F → ƒ   (U+0192)
//   87 → ç   (U+00E7)   ← constant prefix for ALL regional indicators
//   [A6–BF] → one of the chars below, uniquely identifying A–Z
//
// So a garbled flag looks like: ≡ƒç[charA]≡ƒç[charB]  →  ISO code = AB
// ---------------------------------------------------------------------------

const INDICATOR_SUFFIX_TO_LETTER: Record<string, string> = {
  "ª": "A", // ª  (0xA6)
  "º": "B", // º  (0xA7)
  "¿": "C", // ¿  (0xA8)
  "⌐": "D", // ⌐  (0xA9)
  "¬": "E", // ¬  (0xAA)
  "½": "F", // ½  (0xAB)
  "¼": "G", // ¼  (0xAC)
  "¡": "H", // ¡  (0xAD)
  "«": "I", // «  (0xAE)
  "»": "J", // »  (0xAF)
  "░": "K", // ░  (0xB0)
  "▒": "L", // ▒  (0xB1)
  "▓": "M", // ▓  (0xB2)
  "│": "N", // │  (0xB3)
  "┤": "O", // ┤  (0xB4)
  "╡": "P", // ╡  (0xB5)
  "╢": "Q", // ╢  (0xB6)
  "╖": "R", // ╖  (0xB7)
  "╕": "S", // ╕  (0xB8)
  "╣": "T", // ╣  (0xB9)
  "║": "U", // ║  (0xBA)
  "╗": "V", // ╗  (0xBB)
  "╝": "W", // ╝  (0xBC)
  "╜": "X", // ╜  (0xBD)
  "╛": "Y", // ╛  (0xBE)
  "┐": "Z", // ┐  (0xBF)
};

/**
 * Extracts a 2-letter ISO country code from a raw (un-cleaned) string that may
 * contain a garbled flag sequence. Returns null if no valid flag is found.
 */
function extractFlag(raw: string): string | null {
  const letters: string[] = [];
  // Match ≡ƒç followed by exactly one character
  const re = /≡ƒç(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const letter = INDICATOR_SUFFIX_TO_LETTER[m[1]];
    if (letter) letters.push(letter);
  }
  // A flag emoji is always exactly 2 regional indicators
  if (letters.length >= 2) return letters[0] + letters[1];
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedEntry {
  category: string;
  foodName: string;
  restaurantName: string;
  starred: boolean;
  flag: string | null;
  notes: string;
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

/**
 * Strips mojibake/garbled sequences that result from encoding issues in the
 * markitdown export.
 */
function cleanText(raw: string): string {
  return (
    raw
      .replace(/Γ¡É/g, "⭐")
      // All ≡ƒ... sequences (flags, emoji) — drop entirely after flag is extracted
      .replace(/≡ƒ[^\s)]*\s*/g, "")
      .replace(/Γ£Æ/g, "✓")
      .replace(/ΓÇ£/g, '"')
      .replace(/ΓÇ¥/g, '"')
      .replace(/ΓÇÖ/g, "'")
      .replace(/ΓÇô/g, "–")
      .replace(/ΓÇó/g, "•")
      .replace(/ΓÇª/g, "…")
      .replace(/Γ├¬/g, "ê")
      .replace(/├¬/g, "ê")
      .replace(/├⌐/g, "é")
      .replace(/Γ¿/g, "é")
      .replace(/├╝/g, "ü")
      .replace(/├╗/g, "û")
      .replace(/Cr├¿me/g, "Crème")
      .replace(/Ros├⌐/g, "Rosé")
      .replace(/Consomm├⌐/g, "Consommé")
      .replace(/Mille Cr├¬pes/g, "Mille Crêpes")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseMarkdown(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split("\n");

  let currentCategory = "";
  let currentEntry: ParsedEntry | null = null;
  // Pending flag extracted from the raw numbered-entry line
  let pendingFlag: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = cleanText(raw);

    // Category heading: **Category Name**
    const categoryMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (categoryMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Numbered entry: "1. Food Name (Restaurant Name) [⭐]"
    const entryMatch = line.match(/^\d+\.\s+(.+)/);
    if (entryMatch && currentCategory) {
      if (currentEntry) entries.push(currentEntry);

      // Extract flag from the RAW line before cleanText strips the sequences
      pendingFlag = extractFlag(raw);

      const entryRaw = entryMatch[1];
      const starred = entryRaw.includes("⭐");
      const entryClean = entryRaw.replace("⭐", "").trim();

      // Extract restaurant from last set of parentheses
      const parenMatch = entryClean.match(/^(.*)\(([^)]+)\)\s*$/);

      let foodName: string;
      let restaurantName: string;

      if (parenMatch) {
        foodName = parenMatch[1].trim();
        restaurantName = parenMatch[2].trim();
      } else {
        foodName = entryClean.trim();
        restaurantName = "Unknown";
      }

      currentEntry = {
        category: currentCategory,
        foodName,
        restaurantName,
        starred,
        flag: pendingFlag,
        notes: "",
      };
      continue;
    }

    // Bullet point
    const bulletMatch = line.match(/^\*\s+(.+)/);
    if (bulletMatch && currentEntry) {
      const bulletText = bulletMatch[1].trim();
      currentEntry.notes = currentEntry.notes
        ? `${currentEntry.notes}\n${bulletText}`
        : bulletText;
      continue;
    }
  }

  if (currentEntry) entries.push(currentEntry);

  return entries;
}

// ---------------------------------------------------------------------------
// Scan report — printed before any DB work
// ---------------------------------------------------------------------------

function printScanReport(entries: ParsedEntry[]): void {
  const flagged = entries.filter((e) => e.flag !== null);
  const uniqueMap = new Map<string, string>();
  for (const e of flagged) {
    const key = `${e.restaurantName}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, e.flag!);
  }

  console.log(`\n--- Flag scan (${flagged.length} flagged entries) ---`);
  if (uniqueMap.size === 0) {
    console.log("  No flag sequences detected.");
  } else {
    const byFlag = new Map<string, string[]>();
    for (const [rest, flag] of uniqueMap) {
      if (!byFlag.has(flag)) byFlag.set(flag, []);
      byFlag.get(flag)!.push(rest);
    }
    for (const [flag, restaurants] of [...byFlag].sort()) {
      console.log(`  ${flag}: ${restaurants.slice(0, 5).join(", ")}${restaurants.length > 5 ? ` … (+${restaurants.length - 5} more)` : ""}`);
    }
  }
  console.log("---\n");
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

async function clearDatabase(): Promise<void> {
  console.log("Clearing existing data (Reviews → Entries → Restaurants)…");
  const rv = await prisma.review.deleteMany({});
  const ev = await prisma.entry.deleteMany({});
  const rst = await prisma.restaurant.deleteMany({});
  console.log(
    `  Deleted ${rv.count} reviews, ${ev.count} entries, ${rst.count} restaurants.\n`
  );
}

// ---------------------------------------------------------------------------
// Database import
// ---------------------------------------------------------------------------

async function importEntries(entries: ParsedEntry[]): Promise<void> {
  let created = 0;
  let skipped = 0;
  let flagsSet = 0;
  let errors = 0;

  console.log(`Importing ${entries.length} entries…\n`);

  for (const entry of entries) {
    try {
      // 1. Find or create Restaurant
      let restaurant = await prisma.restaurant.findFirst({
        where: { name: entry.restaurantName },
      });
      if (!restaurant) {
        restaurant = await prisma.restaurant.create({
          data: { name: entry.restaurantName },
        });
      }

      // 2. Check if Entry already exists
      const existing = await prisma.entry.findFirst({
        where: {
          foodName: entry.foodName,
          restaurantId: restaurant.id,
          category: entry.category,
        },
        include: { reviews: true },
      });

      if (existing) {
        // Backfill review if missing
        if (entry.notes && existing.reviews.length === 0) {
          await prisma.review.create({
            data: {
              entryId: existing.id,
              notes: entry.notes,
              date: null,
              rating1: null,
              rating2: null,
              rating3: null,
              overallRating: null,
            },
          });
        }
        // Backfill flag if entry has none yet
        if (entry.flag !== null && existing.flag === null) {
          await prisma.entry.update({
            where: { id: existing.id },
            data: { flag: entry.flag },
          });
          flagsSet++;
        }
        skipped++;
        continue;
      }

      // 3. Create Entry
      const newEntry = await prisma.entry.create({
        data: {
          foodName: entry.foodName,
          category: entry.category,
          starred: entry.starred,
          restaurantId: restaurant.id,
          flag: entry.flag,
        },
      });

      // 4. Create Review with notes
      if (entry.notes) {
        await prisma.review.create({
          data: {
            entryId: newEntry.id,
            notes: entry.notes,
            date: null,
            rating1: null,
            rating2: null,
            rating3: null,
            overallRating: null,
          },
        });
      }

      created++;
      if (created % 50 === 0) {
        console.log(`  ✓ ${created} entries created so far…`);
      }
    } catch (err) {
      errors++;
      console.error(
        `  ✗ Error importing "${entry.foodName}" (${entry.restaurantName}):`,
        err
      );
    }
  }

  console.log("\n--- Import complete ---");
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already existed)`);
  if (flagsSet > 0) console.log(`  Flags backfilled: ${flagsSet}`);
  console.log(`  Errors  : ${errors}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const doClear = args.includes("--clear");

  if (!filePath) {
    console.error(
      "Usage: npx ts-node src/scripts/import.ts <path-to-entries.md> [--clear]"
    );
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  console.log(`Reading: ${resolved}`);
  const content = fs.readFileSync(resolved, "utf-8");

  const entries = parseMarkdown(content);
  console.log(`Parsed ${entries.length} entries across categories.`);

  // Always print the flag scan report before touching the DB
  printScanReport(entries);

  // Preview first 5
  console.log("First 5 parsed entries:");
  entries.slice(0, 5).forEach((e, i) => {
    console.log(
      `  ${i + 1}. [${e.category}] "${e.foodName}" @ ${e.restaurantName}${e.flag ? ` [${e.flag}]` : ""} ${e.starred ? "⭐" : ""}`
    );
  });
  console.log();

  if (doClear) await clearDatabase();

  await importEntries(entries);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
