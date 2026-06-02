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

  const ranked = entries
    .map(e => {
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
      };
    })
    .sort((a, b) => {
      if (a.avgRating !== null && b.avgRating !== null) return b.avgRating - a.avgRating;
      if (a.avgRating !== null) return -1;
      if (b.avgRating !== null) return 1;
      return a.foodName.localeCompare(b.foodName);
    });

  const byCategory = ranked.reduce<Record<string, typeof ranked>>((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});

  res.json(byCategory);
});

export default router;
