export interface Review {
  id: number;
  entryId: number;
  date: string | null;
  notes: string | null;
  rating1: number | null;
  rating2: number | null;
  rating3: number | null;
  overallRating: number | null;
  createdAt: string;
}

export interface Entry {
  id: number;
  foodName: string;
  category: string;
  restaurantId: number;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  restaurant: { name: string };
  reviews: Pick<Review, 'overallRating'>[];
}

export interface EntryDetail extends Omit<Entry, 'reviews'> {
  reviews: Review[];
}

export interface RankedEntry {
  id: number;
  foodName: string;
  category: string;
  starred: boolean;
  restaurant: string;
  avgRating: number;
  reviewCount: number;
}

export type Rankings = Record<string, RankedEntry[]>;
