import axios from 'axios';
import type { Entry, EntryDetail } from '../types';

export const getEntries = () =>
  axios.get<Entry[]>('/api/entries').then(r => r.data);

export const getEntry = (id: number) =>
  axios.get<EntryDetail>(`/api/entries/${id}`).then(r => r.data);

export const searchEntries = (q: string) =>
  axios.get<Entry[]>(`/api/entries/search?q=${encodeURIComponent(q)}`).then(r => r.data);

export const patchEntry = (
  id: number,
  data: { starred?: boolean; foodName?: string; category?: string; flag?: string | null; tryAgain?: boolean; neverAgain?: boolean }
) => axios.patch<Omit<Entry, 'reviews'>>(`/api/entries/${id}`, data).then(r => r.data);

export const deleteEntry = (id: number) =>
  axios.delete(`/api/entries/${id}`).then(() => {});

export const bulkMoveEntries = (data: { entryIds: number[]; category: string }) =>
  axios.patch<{ updated: number }>('/api/entries/bulk-move', data).then(r => r.data);

export const createEntry = (data: {
  foodName: string;
  category: string;
  restaurantName: string;
  starred: boolean;
  flag?: string | null;
}) => axios.post<EntryDetail>('/api/entries', data).then(r => r.data);
