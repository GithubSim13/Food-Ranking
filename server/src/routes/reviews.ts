import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.post('/', async (req, res) => {
  const { entryId, date, notes, rating1, rating2, rating3, overallRating } = req.body;

  if (!entryId || !date) {
    res.status(400).json({ error: 'entryId and date are required' });
    return;
  }

  const review = await prisma.review.create({
    data: {
      entryId: Number(entryId),
      date: new Date(date),
      notes: notes ?? null,
      rating1: rating1 != null ? Number(rating1) : null,
      rating2: rating2 != null ? Number(rating2) : null,
      rating3: rating3 != null ? Number(rating3) : null,
      overallRating: overallRating != null ? Number(overallRating) : null,
    },
  });

  res.status(201).json(review);
});

export default router;
