import axios from 'axios';
import type { CategorySummary } from '../types';

export const getCategories = () =>
  axios.get<CategorySummary[]>('/api/categories').then(r => r.data);

export const renameCategory = (oldName: string, newName: string) =>
  axios
    .patch<{ updated: number }>(`/api/categories/${encodeURIComponent(oldName)}`, { name: newName })
    .then(r => r.data);

export const deleteCategory = (name: string) =>
  axios.delete(`/api/categories/${encodeURIComponent(name)}`).then(() => {});
