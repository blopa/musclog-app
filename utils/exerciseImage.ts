/**
 * Bundled exercise images for exercisesEnUS.json by image number (index+1).
 * Metro requires static require() paths. Single source of truth: keys are the
 * image numbers that exist (1.png … 105.png); index i uses (i+1), or fallback.
 */
export const FALLBACK_EXERCISE_IMAGE = require('../assets/exercises/fallback.png');

/** Image number (1–105) → require() result. Only keys for existing .png files. */
const EXERCISE_IMAGE_ASSETS: Record<number, number> = {
  1: require('../assets/exercises/1.png'),
  2: require('../assets/exercises/2.png'),
  3: require('../assets/exercises/3.png'),
  4: require('../assets/exercises/4.png'),
  5: require('../assets/exercises/5.png'),
  6: require('../assets/exercises/6.png'),
  7: require('../assets/exercises/7.png'),
  8: require('../assets/exercises/8.png'),
  9: require('../assets/exercises/9.png'),
  10: require('../assets/exercises/10.png'),
  11: require('../assets/exercises/11.png'),
  12: require('../assets/exercises/12.png'),
  13: require('../assets/exercises/13.png'),
  14: require('../assets/exercises/14.png'),
  15: require('../assets/exercises/15.png'),
  16: require('../assets/exercises/16.png'),
  17: require('../assets/exercises/17.png'),
  18: require('../assets/exercises/18.png'),
  19: require('../assets/exercises/19.png'),
  20: require('../assets/exercises/20.png'),
  21: require('../assets/exercises/21.png'),
  22: require('../assets/exercises/22.png'),
  23: require('../assets/exercises/23.png'),
  24: require('../assets/exercises/24.png'),
  25: require('../assets/exercises/25.png'),
  26: require('../assets/exercises/26.png'),
  27: require('../assets/exercises/27.png'),
  28: require('../assets/exercises/28.png'),
  29: require('../assets/exercises/29.png'),
  30: require('../assets/exercises/30.png'),
  31: require('../assets/exercises/31.png'),
  32: require('../assets/exercises/32.png'),
  33: require('../assets/exercises/33.png'),
  34: require('../assets/exercises/34.png'),
  38: require('../assets/exercises/38.png'),
  39: require('../assets/exercises/39.png'),
  41: require('../assets/exercises/41.png'),
  47: require('../assets/exercises/47.png'),
  48: require('../assets/exercises/48.png'),
  49: require('../assets/exercises/49.png'),
  51: require('../assets/exercises/51.png'),
  52: require('../assets/exercises/52.png'),
  53: require('../assets/exercises/53.png'),
  64: require('../assets/exercises/64.png'),
  65: require('../assets/exercises/65.png'),
  84: require('../assets/exercises/84.png'),
  85: require('../assets/exercises/85.png'),
  86: require('../assets/exercises/86.png'),
  89: require('../assets/exercises/89.png'),
  90: require('../assets/exercises/90.png'),
  91: require('../assets/exercises/91.png'),
  94: require('../assets/exercises/94.png'),
  105: require('../assets/exercises/105.png'),
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

  return FALLBACK_EXERCISE_IMAGE;
}

/**
 * Returns the original asset filename for the given exercisesEnUS.json array index (e.g. 1.png, fallback.png).
 */
export function getExerciseImageFilenameByIndex(index: number): string {
  const num = index + 1;

  if (index >= 0 && num <= MAX_IMAGE_NUMBER && num in EXERCISE_IMAGE_ASSETS) {
    return `${num}.png`;
  }

  return 'fallback.png';
}
