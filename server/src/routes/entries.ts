import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const entries = await prisma.entry.findMany({
    where: { foodName: { contains: q, mode: 'insensitive' } },
    include: { restaurant: { select: { name: true } } },
    orderBy: { foodName: 'asc' },
  });
  res.json(entries);
});

router.get('/', async (_req, res) => {
  const entries = await prisma.entry.findMany({
    include: {
      restaurant: { select: { name: true } },
      reviews: { select: { overallRating: true, date: true, rating1: true, rating2: true, rating3: true, notes: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(entries);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }
  const entry = await prisma.entry.findUnique({
    where: { id },
    include: {
      restaurant: true,
      reviews: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!entry) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(entry);
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }

  const { starred, foodName, category, flag } = req.body as {
    starred?: unknown;
    foodName?: unknown;
    category?: unknown;
    flag?: unknown;
  };
  const data: { starred?: boolean; foodName?: string; category?: string; flag?: string | null } = {};
  if (starred !== undefined) data.starred = Boolean(starred);
  if (foodName !== undefined) data.foodName = String(foodName);
  if (category !== undefined) data.category = String(category);
  if (flag !== undefined) data.flag = flag === null ? null : String(flag);

  const entry = await prisma.entry.update({
    where: { id },
    data,
    include: { restaurant: { select: { name: true } } },
  });

  res.json(entry);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid entry id' });
    return;
  }
  await prisma.review.deleteMany({ where: { entryId: id } });
  await prisma.entry.delete({ where: { id } });
  res.status(204).send();
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

  let restaurant = await prisma.restaurant.findFirst({ where: { name: String(restaurantName) } });
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
    include: { restaurant: { select: { name: true } } },
  });

  res.status(201).json(entry);
});

export default router;
