import axios from 'axios';
import type { Review } from '../types';

export const createReview = (data: {
  entryId: number;
  date: string;
  notes?: string;
  rating1?: number;
  rating2?: number;
  rating3?: number;
  overallRating?: number;
}) => axios.post<Review>('/api/reviews', data).then(r => r.data);
