/**
 * Bulk import script for food entries from the exported Google Docs markdown.
 *
 * Usage (from /server directory):
 *   npx ts-node src/scripts/import.ts path/to/entries.md
 *
 * Safe to re-run: uses upsert on Restaurant and Entry (matched by foodName +
 * restaurantName + category). Will NOT duplicate entries on repeated runs.
 * Reviews are only created if no review already exists for that entry.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
console.log("Full DB URL:", process.env.DATABASE_URL);

import { PrismaClient } from "../generated/prisma/client";
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedEntry {
  category: string;
  foodName: string;
  restaurantName: string;
  starred: boolean;
  notes: string; // bullet points joined as newline-separated string
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Strips mojibake/garbled sequences that result from encoding issues in the
 * markitdown export. Specifically:
 *   Γ¡É  → ⭐  (the star marker we care about)
 *   ≡ƒç╕≡ƒç¼ → "" (Singapore flag emoji — we just drop it)
 *   Other flag/emoji sequences → ""
 */
function cleanText(raw: string): string {
  return (
    raw
      // These are the two known mojibake patterns from the markitdown export
      .replace(/Γ¡É/g, "⭐")
      // Singapore flag and similar multi-byte emoji garble — drop entirely
      .replace(/[\u2550-\u2570\u25A0-\u25FF\u2580-\u259F][\uFCC0-\uFCFF][\uFCC0-\uFCFF][\uFCC0-\uFCFF][\uFCC0-\uFCFF]/g, "")
      .replace(/≡ƒ[^\s)]*\s*/g, "")
      // Curly quotes and other common mojibake
      .replace(/Γ£Æ/g, "✓")
      .replace(/ΓÇ£/g, '"')
      .replace(/ΓÇ¥/g, '"')
      .replace(/ΓÇÖ/g, "'")
      .replace(/ΓÇô/g, "–")
      .replace(/ΓÇó/g, "•")
      .replace(/ΓÇª/g, "…")
      // accented chars that got garbled
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

function parseMarkdown(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split("\n");

  let currentCategory = "";
  let currentEntry: ParsedEntry | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = cleanText(raw);

    // Category heading: **Category Name**
    const categoryMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (categoryMatch) {
      // Save previous entry before switching category
      if (currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Numbered entry: "1. Food Name (Restaurant Name) [⭐]"
    // Handles both "N. " and "N.  " (double space for 10+)
    const entryMatch = line.match(/^\d+\.\s+(.+)/);
    if (entryMatch && currentCategory) {
      // Save previous entry
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const entryRaw = entryMatch[1];
      const starred = entryRaw.includes("⭐");
      // Remove the star marker for parsing
      const entryClean = entryRaw.replace("⭐", "").trim();

      // Extract restaurant name from parentheses at the end
      // e.g. "Smoked Onion Cheeseburger (Shake Shack)"
      // Restaurant may contain nested parens in rare cases, so grab the LAST pair
      const parenMatch = entryClean.match(/^(.*)\(([^)]+)\)\s*$/);

      let foodName: string;
      let restaurantName: string;

      if (parenMatch) {
        foodName = parenMatch[1].trim();
        restaurantName = parenMatch[2].trim();
      } else {
        // No restaurant found — use "Unknown"
        foodName = entryClean.trim();
        restaurantName = "Unknown";
      }

      currentEntry = {
        category: currentCategory,
        foodName,
        restaurantName,
        starred,
        notes: "",
      };
      continue;
    }

    // Bullet point: "* note text" (cleanText trims leading whitespace)
    const bulletMatch = line.match(/^\*\s+(.+)/);
    if (bulletMatch && currentEntry) {
      const bulletText = bulletMatch[1].trim();
      currentEntry.notes = currentEntry.notes
        ? `${currentEntry.notes}\n${bulletText}`
        : bulletText;
      continue;
    }
  }

  // Don't forget the last entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Database import
// ---------------------------------------------------------------------------

async function importEntries(entries: ParsedEntry[]): Promise<void> {
  let created = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`\nImporting ${entries.length} entries...\n`);

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

      // 2. Check if Entry already exists (match on foodName + restaurantId + category)
      const existing = await prisma.entry.findFirst({
        where: {
          foodName: entry.foodName,
          restaurantId: restaurant.id,
          category: entry.category,
        },
        include: { reviews: true },
      });

      if (existing) {
        // Entry exists — backfill review if it has none yet
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
        },
      });

    // 4. Create a Review with notes (no ratings — those are TBD)
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

      // Progress indicator every 50 entries
      if (created % 50 === 0) {
        console.log(`  ✓ ${created} entries created so far...`);
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
  console.log(`  Errors  : ${errors}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npx ts-node src/scripts/import.ts <path-to-entries.md>");
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

  // Preview first 5 for sanity check
  console.log("\nFirst 5 parsed entries:");
  entries.slice(0, 5).forEach((e, i) => {
    console.log(
      `  ${i + 1}. [${e.category}] "${e.foodName}" @ ${e.restaurantName} ${e.starred ? "⭐" : ""}`
    );
  });

  await importEntries(entries);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});