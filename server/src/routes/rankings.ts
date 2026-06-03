import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const entries = await prisma.entry.findMany({
    include: {
      restaurant: { select: { name: true } },
      reviews: { select: { overallRating: true } },
    },
  });

  const ranked = entries.map(e => {
    const ratings = e.reviews
      .map(r => r.overallRating)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
        : null;
    return {
      id: e.id,
      foodName: e.foodName,
      category: e.category,
      starred: e.starred,
      flag: e.flag,
      restaurant: e.restaurant.name,
      avgRating,
      reviewCount: ratings.length,
      manualRank: e.manualRank,
    };
  });

  // Sort: manualRank asc (nulls last), then avgRating desc, then foodName
  ranked.sort((a, b) => {
    const aHasRank = a.manualRank !== null;
    const bHasRank = b.manualRank !== null;
    if (aHasRank && bHasRank) return a.manualRank! - b.manualRank!;
    if (aHasRank) return -1;
    if (bHasRank) return 1;
    if (a.avgRating !== null && b.avgRating !== null) return b.avgRating - a.avgRating;
    if (a.avgRating !== null) return -1;
    if (b.avgRating !== null) return 1;
    return a.foodName.localeCompare(b.foodName);
  });

  const grouped = ranked.reduce<Record<string, typeof ranked>>((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});

  const byCategory = Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {} as Record<string, typeof ranked>);

  res.json(byCategory);
});

router.patch('/reorder', async (req, res) => {
  const { category, orderedIds } = req.body as { category: string; orderedIds: number[] };

  if (!category || !Array.isArray(orderedIds)) {
    res.status(400).json({ error: 'category and orderedIds are required' });
    return;
  }

  // Validate all IDs belong to this category
  const entries = await prisma.entry.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, category: true },
  });

  const invalid = entries.filter(e => e.category !== category);
  if (invalid.length > 0) {
    res.status(400).json({ error: 'Some IDs do not belong to the given category' });
    return;
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.entry.update({ where: { id }, data: { manualRank: index } })
    )
  );

  res.json({ ok: true });
});

export default router;
