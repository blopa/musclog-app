export type MealObservationItem = {
  name: string;
  portion: string;
  preparation?: string;
  confidence: 'high' | 'medium' | 'low';
};

export type MealObservation = {
  mealCount: number;
  items: MealObservationItem[];
  scaleCues: string[];
  addedFats: string[];
  extras: string[];
  uncertain: string[];
};

const MAX_TEXT_LENGTH = 120;
const MAX_ITEMS = 20;
const MAX_OTHER = 10;
const MAX_MEAL_COUNT = 10;

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH) : '';

const readList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(cleanText)
    .filter((text) => text.length > 0)
    .slice(0, MAX_OTHER);
};

const readMealCount = (value: unknown): number => {
  const number = typeof value === 'string' ? Number(value.trim()) : value;

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    return 1;
  }

  return Math.min(MAX_MEAL_COUNT, Math.max(1, Math.round(number)));
};

const readItem = (value: unknown): MealObservationItem | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const name = cleanText(raw.name);

  if (!name) {
    return null;
  }

  const preparation = cleanText(raw.preparation);
  const confidence =
    raw.confidence === 'high' || raw.confidence === 'low' || raw.confidence === 'medium'
      ? raw.confidence
      : 'medium';

  return {
    name,
    portion: cleanText(raw.portion),
    ...(preparation ? { preparation } : {}),
    confidence,
  };
};

/** Model output, so it is read tolerantly. Null when no item survives. */
export function parseMealObservation(value: unknown): MealObservation | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(readItem)
    .filter((item): item is MealObservationItem => item !== null)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return null;
  }

  return {
    mealCount: readMealCount(raw.mealCount),
    items,
    scaleCues: readList(raw.scaleCues),
    addedFats: readList(raw.addedFats),
    extras: readList(raw.extras),
    uncertain: readList(raw.uncertain),
  };
}

const safe = (text: string): string => text.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();

/** The block appended to the recipe request. No angle brackets: model output sits between word markers. */
export function formatMealObservation(obs: MealObservation): string {
  const lines = [
    'These are notes from a first look at the meal. Where the photo or description disagrees with them, the photo or description wins.',
    '--- FIRST LOOK ---',
  ];

  if (obs.mealCount > 1) {
    lines.push(`Separate meals shown: ${obs.mealCount}`);
  }

  for (const item of obs.items) {
    const details = [
      safe(item.portion),
      item.preparation ? safe(item.preparation) : '',
      `${item.confidence} confidence`,
    ].filter((part) => part.length > 0);

    lines.push(`- ${safe(item.name)}: ${details.join(', ')}`);
  }

  const sections: [string, string[]][] = [
    ['Scale cues', obs.scaleCues],
    ['Added fats, sauces and drinks', obs.addedFats],
    ['Extras', obs.extras],
    ['Uncertain', obs.uncertain],
  ];

  for (const [label, list] of sections) {
    if (list.length > 0) {
      lines.push(`${label}: ${list.map(safe).join('; ')}`);
    }
  }

  lines.push('--- END OF FIRST LOOK ---');

  return lines.join('\n');
}
