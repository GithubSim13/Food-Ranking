import axios from 'axios';
import type { RestaurantSummary } from '../types';

export const getRestaurants = () =>
  axios.get<RestaurantSummary[]>('/api/restaurants').then(r => r.data);

export const patchRestaurant = (id: number, data: { name: string }) =>
  axios.patch<{ id: number; name: string }>(`/api/restaurants/${id}`, data).then(r => r.data);

export const deleteRestaurant = (id: number) =>
  axios.delete(`/api/restaurants/${id}`).then(() => {});
