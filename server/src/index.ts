import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import entriesRouter from './routes/entries';
import rankingsRouter from './routes/rankings';
import reviewsRouter from './routes/reviews';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/entries', entriesRouter);
app.use('/api/rankings', rankingsRouter);
app.use('/api/reviews', reviewsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
