// One photo of a meal as every AI request carries it. Pure and relative-import-only: it is the one
// place a data URL or bare base64 string becomes `{ base64, mimeType }`, so no caller re-parses it.

export type MealImage = { base64: string; mimeType: string };

/** The most photos one meal estimate may carry (the camera's carousel and every provider cap). */
export const MAX_MEAL_IMAGES = 5;

/**
 * Reads a photo given as a `data:image/...;base64,` URL or as bare base64. The camera pipeline
 * produces JPEG, so anything that is not declared PNG is JPEG.
 */
export function toMealImage(dataUrlOrBase64: string): MealImage {
  const base64 = dataUrlOrBase64.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = dataUrlOrBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  return { base64, mimeType };
}

/** Accepts one photo or a list, always giving back a list without blanks. */
export function toMealImages(input: string | readonly string[]): MealImage[] {
  const list = typeof input === 'string' ? [input] : input;

  return list.filter((item) => item.trim() !== '').map(toMealImage);
}
