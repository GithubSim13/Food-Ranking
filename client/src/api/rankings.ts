import axios from 'axios';
import type { Rankings } from '../types';

export const getRankings = () =>
  axios.get<Rankings>('/api/rankings').then(r => r.data);
