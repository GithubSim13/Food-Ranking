import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const restaurants = await prisma.restaurant.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(
    restaurants.map(r => ({
      id: r.id,
      name: r.name,
      entryCount: r._count.entries,
    }))
  );
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid restaurant id' });
    return;
  }
  const { name } = req.body as { name?: unknown };
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const restaurant = await prisma.restaurant.update({
    where: { id },
    data: { name },
  });
  res.json(restaurant);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid restaurant id' });
    return;
  }
  const count = await prisma.entry.count({ where: { restaurantId: id } });
  if (count > 0) {
    res.status(400).json({ error: `Cannot delete: ${count} ${count === 1 ? 'entry belongs' : 'entries belong'} to this restaurant.` });
    return;
  }
  await prisma.restaurant.delete({ where: { id } });
  res.status(204).send();
});

export default router;
