/**
 * Bundled exercise images for exercisesEnUS.json by image number (index+1).
 * Metro requires static require() paths. Single source of truth: keys are the
 * image numbers that exist (1.webp … 105.webp); index i uses (i+1), or fallback.
 */
const FALLBACK_IMAGE = require('../assets/exercises/fallback.webp');

/** Image number (1–105) → require() result. Only keys for existing .webp files. */
const EXERCISE_IMAGE_ASSETS: Record<number, number> = {
  1: require('../assets/exercises/1.webp'),
  2: require('../assets/exercises/2.webp'),
  3: require('../assets/exercises/3.webp'),
  4: require('../assets/exercises/4.webp'),
  5: require('../assets/exercises/5.webp'),
  6: require('../assets/exercises/6.webp'),
  7: require('../assets/exercises/7.webp'),
  8: require('../assets/exercises/8.webp'),
  9: require('../assets/exercises/9.webp'),
  10: require('../assets/exercises/10.webp'),
  11: require('../assets/exercises/11.webp'),
  12: require('../assets/exercises/12.webp'),
  13: require('../assets/exercises/13.webp'),
  14: require('../assets/exercises/14.webp'),
  15: require('../assets/exercises/15.webp'),
  16: require('../assets/exercises/16.webp'),
  17: require('../assets/exercises/17.webp'),
  18: require('../assets/exercises/18.webp'),
  19: require('../assets/exercises/19.webp'),
  20: require('../assets/exercises/20.webp'),
  21: require('../assets/exercises/21.webp'),
  22: require('../assets/exercises/22.webp'),
  23: require('../assets/exercises/23.webp'),
  24: require('../assets/exercises/24.webp'),
  25: require('../assets/exercises/25.webp'),
  26: require('../assets/exercises/26.webp'),
  27: require('../assets/exercises/27.webp'),
  28: require('../assets/exercises/28.webp'),
  29: require('../assets/exercises/29.webp'),
  30: require('../assets/exercises/30.webp'),
  31: require('../assets/exercises/31.webp'),
  32: require('../assets/exercises/32.webp'),
  33: require('../assets/exercises/33.webp'),
  34: require('../assets/exercises/34.webp'),
  38: require('../assets/exercises/38.webp'),
  39: require('../assets/exercises/39.webp'),
  41: require('../assets/exercises/41.webp'),
  47: require('../assets/exercises/47.webp'),
  48: require('../assets/exercises/48.webp'),
  49: require('../assets/exercises/49.webp'),
  51: require('../assets/exercises/51.webp'),
  52: require('../assets/exercises/52.webp'),
  53: require('../assets/exercises/53.webp'),
  64: require('../assets/exercises/64.webp'),
  65: require('../assets/exercises/65.webp'),
  84: require('../assets/exercises/84.webp'),
  85: require('../assets/exercises/85.webp'),
  86: require('../assets/exercises/86.webp'),
  89: require('../assets/exercises/89.webp'),
  90: require('../assets/exercises/90.webp'),
  91: require('../assets/exercises/91.webp'),
  94: require('../assets/exercises/94.webp'),
  105: require('../assets/exercises/105.webp'),
};

const MAX_IMAGE_NUMBER = Math.max(...Object.keys(EXERCISE_IMAGE_ASSETS).map(Number));

/**
 * Returns the require() source for the exercise image at the given exercisesEnUS.json array index.
 */
export function getBundledExerciseImageSourceByIndex(index: number): number {
  const num = index + 1;

  if (index >= 0 && num <= MAX_IMAGE_NUMBER) {
    const source = EXERCISE_IMAGE_ASSETS[num];
    if (source != null) {
      return source;
    }
  }

  return FALLBACK_IMAGE;
}

/**
 * Returns the original asset filename for the given exercisesEnUS.json array index (e.g. 1.webp, fallback.webp).
 */
export function getExerciseImageFilenameByIndex(index: number): string {
  const num = index + 1;

  if (index >= 0 && num <= MAX_IMAGE_NUMBER && num in EXERCISE_IMAGE_ASSETS) {
    return `${num}.webp`;
  }

  return 'fallback.webp';
}
