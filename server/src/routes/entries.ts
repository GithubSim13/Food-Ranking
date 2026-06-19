import { Router } from 'express';
import prisma from '../lib/prisma';
import { parseId, restaurantNameSelect } from '../lib/routeHelpers';

const router = Router();

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '');
    const entries = await prisma.entry.findMany({
      where: {
        OR: [
          { foodName: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { restaurant: { name: { contains: q, mode: 'insensitive' } } },
          { reviews: { some: { notes: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      include: { restaurant: restaurantNameSelect },
      orderBy: { foodName: 'asc' },
    });
    res.json(entries);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const entries = await prisma.entry.findMany({
      include: {
        restaurant: restaurantNameSelect,
        reviews: { select: { id: true, overallRating: true, date: true, rating1: true, rating2: true, rating3: true, notes: true, uncertainRating: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }
  try {
    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        restaurant: true,
        reviews: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!entry) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(entry);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/bulk-move', async (req, res) => {
  const { entryIds, category } = req.body as { entryIds?: unknown; category?: unknown };
  if (!Array.isArray(entryIds) || entryIds.length === 0 || !entryIds.every(id => Number.isInteger(id))) {
    res.status(400).json({ error: 'entryIds must be a non-empty array of integers' });
    return;
  }
  const trimmed = typeof category === 'string' ? category.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: 'category is required' });
    return;
  }
  try {
    const result = await prisma.entry.updateMany({
      where: { id: { in: entryIds as number[] } },
      data: { category: trimmed },
    });
    res.json({ updated: result.count });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }

  const { starred, foodName, category, flag, tryAgain, neverAgain } = req.body as {
    starred?: unknown;
    foodName?: unknown;
    category?: unknown;
    flag?: unknown;
    tryAgain?: unknown;
    neverAgain?: unknown;
  };
  const data: { starred?: boolean; foodName?: string; category?: string; flag?: string | null; tryAgain?: boolean; neverAgain?: boolean } = {};
  if (starred !== undefined) data.starred = Boolean(starred);
  if (foodName !== undefined) data.foodName = String(foodName);
  if (category !== undefined) data.category = String(category);
  if (flag !== undefined) data.flag = flag != null ? String(flag) : null;
  if (tryAgain !== undefined) data.tryAgain = Boolean(tryAgain);
  if (neverAgain !== undefined) data.neverAgain = Boolean(neverAgain);

  try {
    const entry = await prisma.entry.update({
      where: { id },
      data,
      include: { restaurant: restaurantNameSelect },
    });
    res.json(entry);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }
  try {
    await prisma.review.deleteMany({ where: { entryId: id } });
    await prisma.entry.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { foodName, category, restaurantName, starred, flag } = req.body as {
    foodName?: unknown;
    category?: unknown;
    restaurantName?: unknown;
    starred?: unknown;
    flag?: unknown;
  };

  if (!foodName || !category || !restaurantName) {
    res.status(400).json({ error: 'foodName, category, and restaurantName are required' });
    return;
  }

  try {
    let restaurant = await prisma.restaurant.findFirst({ where: { name: { equals: String(restaurantName), mode: 'insensitive' } } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({ data: { name: String(restaurantName) } });
    }

    const entry = await prisma.entry.create({
      data: {
        foodName: String(foodName),
        category: String(category),
        restaurantId: restaurant.id,
        starred: Boolean(starred ?? false),
        flag: flag != null ? String(flag) : null,
      },
      include: { restaurant: restaurantNameSelect },
    });

    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
