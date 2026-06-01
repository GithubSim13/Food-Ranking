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
    include: { restaurant: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(entries);
});

router.post('/', async (req, res) => {
  const { foodName, category, restaurantName, starred } = req.body;

  if (!foodName || !category || !restaurantName) {
    res.status(400).json({ error: 'foodName, category, and restaurantName are required' });
    return;
  }

  let restaurant = await prisma.restaurant.findFirst({ where: { name: restaurantName } });
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({ data: { name: restaurantName } });
  }

  const entry = await prisma.entry.create({
    data: {
      foodName,
      category,
      restaurantId: restaurant.id,
      starred: starred ?? false,
    },
    include: { restaurant: { select: { name: true } } },
  });

  res.status(201).json(entry);
});

export default router;
