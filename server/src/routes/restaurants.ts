import { Router } from 'express';
import prisma from '../lib/prisma';
import { parseId } from '../lib/routeHelpers';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(
      restaurants.map(r => ({
        id: r.id,
        name: r.name,
        notes: r.notes,
        entryCount: r._count.entries,
      }))
    );
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid restaurant id' });
    return;
  }
  const { name, notes } = req.body as { name?: unknown; notes?: unknown };
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    res.status(400).json({ error: 'notes must be a string' });
    return;
  }
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name,
        ...(notes !== undefined ? { notes: notes === null || notes === '' ? null : notes } : {}),
      },
    });
    res.json(restaurant);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid restaurant id' });
    return;
  }
  try {
    const count = await prisma.entry.count({ where: { restaurantId: id } });
    if (count > 0) {
      res.status(400).json({ error: `Cannot delete: ${count} ${count === 1 ? 'entry belongs' : 'entries belong'} to this restaurant.` });
      return;
    }
    await prisma.restaurant.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
