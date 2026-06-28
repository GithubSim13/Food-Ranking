import { Router } from 'express';
import prisma from '../lib/prisma';
import { Prisma } from '../generated/prisma/client';
import { parseId } from '../lib/routeHelpers';

const router = Router();

function computeOverallRating(
  r1: number | null,
  r2: number | null,
  r3: number | null,
): number | null {
  const candidates = [
    { value: r1, weight: 0.6 },
    { value: r2, weight: 0.1 },
    { value: r3, weight: 0.3 },
  ].filter((r): r is { value: number; weight: number } => r.value !== null);

  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((s, r) => s + r.weight, 0);
  return candidates.reduce((s, r) => s + r.value * r.weight, 0) / totalWeight;
}

router.post('/', async (req, res) => {
  const { entryId, date, notes, rating1, rating2, rating3, uncertainRating, price } = req.body;

  if (!entryId || isNaN(Number(entryId))) {
    res.status(400).json({ error: 'entryId is required and must be a number' });
    return;
  }

  const r1 = rating1 != null ? Number(rating1) : null;
  const r2 = rating2 != null ? Number(rating2) : null;
  const r3 = rating3 != null ? Number(rating3) : null;

  try {
    const review = await prisma.review.create({
      data: {
        entryId: Number(entryId),
        date: date ? new Date(date) : null,
        notes: notes ?? null,
        rating1: r1,
        rating2: r2,
        rating3: r3,
        overallRating: computeOverallRating(r1, r2, r3),
        uncertainRating: uncertainRating === true,
        price: price != null ? Number(price) : null,
      },
    });
    res.status(201).json(review);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid review id' });
    return;
  }

  const { date, notes, rating1, rating2, rating3, uncertainRating, price } = req.body;

  // Partial merge: only update fields explicitly present in the request body, so
  // callers that send a subset (e.g. QuickRatePage sends only the sub-ratings)
  // never wipe untouched fields like date/notes/price/uncertainRating.
  const data: Prisma.ReviewUpdateInput = {};

  if (date !== undefined) data.date = date ? new Date(date) : null;
  if (notes !== undefined) data.notes = notes ?? null;
  if (uncertainRating !== undefined) data.uncertainRating = uncertainRating === true;
  if (price !== undefined) data.price = price != null ? Number(price) : null;

  // Sub-ratings always travel together; recompute overallRating whenever any are sent.
  if (rating1 !== undefined || rating2 !== undefined || rating3 !== undefined) {
    const r1 = rating1 != null ? Number(rating1) : null;
    const r2 = rating2 != null ? Number(rating2) : null;
    const r3 = rating3 != null ? Number(rating3) : null;
    data.rating1 = r1;
    data.rating2 = r2;
    data.rating3 = r3;
    data.overallRating = computeOverallRating(r1, r2, r3);
  }

  try {
    const review = await prisma.review.update({ where: { id }, data });
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid review id' });
    return;
  }
  try {
    await prisma.review.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
