export interface Review {
  id: number;
  entryId: number;
  date: string | null;
  notes: string | null;
  rating1: number | null;
  rating2: number | null;
  rating3: number | null;
  overallRating: number | null;
  uncertainRating: boolean;
  price?: number | null;
  createdAt: string;
}

export interface Entry {
  id: number;
  foodName: string;
  category: string;
  restaurantId: number;
  starred: boolean;
  flag: string | null;
  tryAgain: boolean;
  neverAgain: boolean;
  createdAt: string;
  updatedAt: string;
  restaurant: { name: string };
  reviews: Pick<Review, 'overallRating' | 'date' | 'rating1' | 'rating2' | 'rating3' | 'notes' | 'uncertainRating' | 'price'>[];
}

export interface EntryDetail extends Omit<Entry, 'reviews'> {
  reviews: Review[];
}

export interface RankedEntry {
  id: number;
  foodName: string;
  category: string;
  starred: boolean;
  flag: string | null;
  tryAgain: boolean;
  neverAgain: boolean;
  restaurant: string;
  avgRating: number | null;
  reviewCount: number;
  manualRank: number | null;
  reviews: { notes: string | null }[];
}

export type Rankings = Record<string, RankedEntry[]>;

export interface CategorySummary {
  name: string;
  entryCount: number;
}

export interface RestaurantSummary {
  id: number;
  name: string;
  entryCount: number;
}
