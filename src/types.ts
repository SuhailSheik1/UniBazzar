export type User = {
  id: string;
  email: string;
  name: string;
  gender?: string;
  reliability_score: number;
  response_rate: number;
  available_mode: number;
  lat?: number;
  lng?: number;
};

export type Request = {
  id: string;
  borrower_id: string;
  borrower_name: string;
  item_name: string;
  category: string;
  duration_hours: number;
  max_distance: number;
  gender_preference: string;
  status: 'searching' | 'matched' | 'verified' | 'paid' | 'completed' | 'cancelled';
  lender_id?: string;
  lender_name?: string;
  created_at: string;
};

export type Category = 'Electronics' | 'Tools' | 'Kitchen' | 'Study Materials' | 'Sports & Outdoors' | 'Clothing & Accessories' | 'Books' | 'Other';

export const CATEGORY_PRICING: Record<Category, { base: number; hourly: number; cap: number }> = {
  Electronics: { base: 1, hourly: 2, cap: 10 },
  Tools: { base: 2, hourly: 3, cap: 15 },
  Kitchen: { base: 1, hourly: 1, cap: 6 },
  'Study Materials': { base: 1, hourly: 1.5, cap: 8 },
  'Sports & Outdoors': { base: 2, hourly: 2, cap: 12 },
  'Clothing & Accessories': { base: 1, hourly: 1, cap: 5 },
  Books: { base: 0.5, hourly: 0.5, cap: 3 },
  Other: { base: 1, hourly: 1, cap: 10 },
};

export type LenderItem = {
  id: string;
  user_id: string;
  item_name: string;
  category: string;
  description: string;
  image_url?: string;
  lender_name?: string;
  distance?: number;
  reliability_score?: number;
};
