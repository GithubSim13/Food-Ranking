import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const entries = await prisma.entry.findMany({
    where: { reviews: { some: { overallRating: { not: null } } } },
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
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return {
        id: e.id,
        foodName: e.foodName,
        category: e.category,
        starred: e.starred,
        restaurant: e.restaurant.name,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: ratings.length,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating);

  const byCategory = ranked.reduce<Record<string, typeof ranked>>((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});

  res.json(byCategory);
});

export default router;
