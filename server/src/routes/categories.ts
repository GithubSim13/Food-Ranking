import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const groups = await prisma.entry.groupBy({
      by: ['category'],
      _count: { category: true },
      orderBy: { category: 'asc' },
    });
    res.json(
      groups.map(g => ({
        name: g.category,
        entryCount: g._count.category,
      }))
    );
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:name', async (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName } = req.body as { name?: unknown };
  if (!newName || typeof newName !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const result = await prisma.entry.updateMany({
      where: { category: oldName },
      data: { category: newName },
    });
    res.json({ updated: result.count });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const count = await prisma.entry.count({ where: { category: name } });
    if (count > 0) {
      res.status(400).json({ error: `Cannot delete: ${count} ${count === 1 ? 'entry is' : 'entries are'} assigned to this category.` });
      return;
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
