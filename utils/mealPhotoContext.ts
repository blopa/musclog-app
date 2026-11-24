import type { AddedFat, MealOrigin, MealPhotoDraft } from './mealPhotoDraft';

export type MealPhotoContext = {
  description: string;
  tags: string[];
  name?: string;
  origin?: MealOrigin | null;
  addedFat?: AddedFat | null;
};

const ORIGIN_LINES: Record<MealOrigin, string> = {
  home: 'home cooked',
  restaurant: 'restaurant (restaurant portions are usually larger than home portions)',
  takeaway: 'takeaway (takeaway portions are usually larger than home portions)',
  packaged: 'packaged product',
};

const FAT_LINES: Record<AddedFat, string> = {
  none: 'none',
  some: 'some',
  lots: 'a lot',
};

export function mealPhotoContextFromDraft(draft: MealPhotoDraft): MealPhotoContext {
  return {
    description: draft.description.trim(),
    tags: draft.tags,
    name: draft.name.trim(),
    origin: draft.origin,
    addedFat: draft.addedFat,
  };
}

export function formatMealPhotoContext(
  context: MealPhotoContext | null | undefined
): string | undefined {
  if (!context) {
    return undefined;
  }

  const lines: string[] = [];
  const name = context.name?.trim();
  const description = context.description?.trim();
  if (name) {
    lines.push(`Meal name: ${name}`);
  }

  if (description) {
    lines.push(`User description: ${description}`);
  }

  if (context.origin) {
    lines.push(`Where it's from: ${ORIGIN_LINES[context.origin]}`);
  }

  if (context.addedFat) {
    lines.push(`Added fat (oil, butter): ${FAT_LINES[context.addedFat]}`);
  }

  if (context.tags.length > 0) {
    lines.push(`Tags: ${context.tags.join(', ')}`);
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
