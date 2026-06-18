import type { MicrosData } from '@/database/models';

export type EditedFoodOverrides = {
  name?: string;
  barcode?: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  micros?: Partial<MicrosData>;
};
