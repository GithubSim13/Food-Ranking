import axios from 'axios';
import type { Review } from '../types';

export const createReview = (data: {
  entryId: number;
  date?: string;
  notes?: string;
  rating1?: number;
  rating2?: number;
  rating3?: number;
  retroactive?: boolean;
}) => axios.post<Review>('/api/reviews', data).then(r => r.data);

export type ReviewUpdatePayload = {
  date?: string;
  notes?: string | null;
  rating1?: number | null;
  rating2?: number | null;
  rating3?: number | null;
  retroactive?: boolean;
};

export const updateReview = (id: number, data: ReviewUpdatePayload) =>
  axios.put<Review>(`/api/reviews/${id}`, data).then(r => r.data);

export const deleteReview = (id: number) =>
  axios.delete(`/api/reviews/${id}`).then(() => {});
