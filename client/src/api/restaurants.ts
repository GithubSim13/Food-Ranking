import axios from 'axios';
import type { RestaurantSummary } from '../types';

export const getRestaurants = () =>
  axios.get<RestaurantSummary[]>('/api/restaurants').then(r => r.data);

export const patchRestaurant = (id: number, data: { name: string; notes?: string | null }) =>
  axios.patch<{ id: number; name: string; notes: string | null }>(`/api/restaurants/${id}`, data).then(r => r.data);

export const deleteRestaurant = (id: number) =>
  axios.delete(`/api/restaurants/${id}`).then(() => {});
