import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function computeOverallRating(
  r1: number | null,
  r2: number | null,
  r3: number | null,
): number | null {
  const nonNull = [r1, r2, r3].filter((r): r is number => r !== null);
  return nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null;
}

router.post('/', async (req, res) => {
  const { entryId, date, notes, rating1, rating2, rating3 } = req.body;

  if (!entryId) {
    res.status(400).json({ error: 'entryId is required' });
    return;
  }

  const r1 = rating1 != null ? Number(rating1) : null;
  const r2 = rating2 != null ? Number(rating2) : null;
  const r3 = rating3 != null ? Number(rating3) : null;

  const review = await prisma.review.create({
    data: {
      entryId: Number(entryId),
      date: date ? new Date(date) : null,
      notes: notes ?? null,
      rating1: r1,
      rating2: r2,
      rating3: r3,
      overallRating: computeOverallRating(r1, r2, r3),
    },
  });

  res.status(201).json(review);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid review id' });
    return;
  }

  const { date, notes, rating1, rating2, rating3 } = req.body;

  const r1 = rating1 != null ? Number(rating1) : null;
  const r2 = rating2 != null ? Number(rating2) : null;
  const r3 = rating3 != null ? Number(rating3) : null;

  const review = await prisma.review.update({
    where: { id },
    data: {
      date: date ? new Date(date) : null,
      notes: notes ?? null,
      rating1: r1,
      rating2: r2,
      rating3: r3,
      overallRating: computeOverallRating(r1, r2, r3),
    },
  });

  res.json(review);
});

export default router;
