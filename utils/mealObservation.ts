export type MealObservationItem = {
  name: string;
  portion: string;
  preparation?: string;
  confidence: 'high' | 'medium' | 'low';
};

export type MealObservation = {
  mealCount: number;
  /** One or two plain sentences: how the food is held or served, the container, the place, the angle. */
  scene: string;
  /** Where it was served: restaurant, home, takeaway... Empty when unknown. */
  setting: string;
  /** What holds the food: plate, bowl, box, hand... Empty when unknown. */
  container: string;
  /** How big the container is, in words or centimetres (never the food). Empty when unknown. */
  containerSize: string;
  items: MealObservationItem[];
  scaleCues: string[];
  addedFats: string[];
  extras: string[];
  uncertain: string[];
};

const MAX_TEXT_LENGTH = 120;
const MAX_SCENE_LENGTH = 300;
const MAX_ITEMS = 20;
const MAX_OTHER = 10;
const MAX_MEAL_COUNT = 10;

const cleanText = (value: unknown, max = MAX_TEXT_LENGTH): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** The model writes "unknown" when it cannot tell; that is no note at all. */
const cleanNote = (value: unknown, max = MAX_TEXT_LENGTH): string => {
  const text = cleanText(value, max);

  return /^(unknown|n\/a|none|not sure|unclear)\.?$/i.test(text) ? '' : text;
};

const readList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => cleanText(entry))
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
    scene: cleanNote(raw.scene, MAX_SCENE_LENGTH),
    setting: cleanNote(raw.setting),
    container: cleanNote(raw.container),
    containerSize: cleanNote(raw.containerSize),
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
    'These are notes from a first look at the meal. Where the photo or description disagrees with them, the photo or description wins. Use the container, how big it is and the setting to judge how large each portion is.',
    '--- FIRST LOOK ---',
  ];

  if (obs.scene) {
    lines.push(`Scene: ${safe(obs.scene)}`);
  }

  if (obs.setting) {
    lines.push(`Setting: ${safe(obs.setting)}`);
  }

  if (obs.container) {
    lines.push(
      `Container: ${safe(obs.container)}${obs.containerSize ? ` (${safe(obs.containerSize)})` : ''}`
    );
  } else if (obs.containerSize) {
    lines.push(`Container size: ${safe(obs.containerSize)}`);
  }

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
