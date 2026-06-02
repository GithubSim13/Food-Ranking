import axios from 'axios';
import type { Rankings } from '../types';

export const getRankings = () =>
  axios.get<Rankings>('/api/rankings').then(r => r.data);

export async function reorderCategory(category: string, orderedIds: number[]): Promise<void> {
  await axios.patch('/api/rankings/reorder', { category, orderedIds });
}
