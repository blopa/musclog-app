/**
 * Bundled exercise images by exercisesEnUS.json array index.
 * Metro requires static require() paths, so we explicitly require each asset.
 * Used at seed time to copy the correct image per exercise into document storage.
 */
const FALLBACK_IMAGE = require('../assets/exercises/fallback.webp');

const IMG_1 = require('../assets/exercises/1.webp');
const IMG_2 = require('../assets/exercises/2.webp');
const IMG_3 = require('../assets/exercises/3.webp');
const IMG_4 = require('../assets/exercises/4.webp');
const IMG_5 = require('../assets/exercises/5.webp');
const IMG_6 = require('../assets/exercises/6.webp');
const IMG_7 = require('../assets/exercises/7.webp');
const IMG_8 = require('../assets/exercises/8.webp');
const IMG_9 = require('../assets/exercises/9.webp');
const IMG_10 = require('../assets/exercises/10.webp');
const IMG_11 = require('../assets/exercises/11.webp');
const IMG_12 = require('../assets/exercises/12.webp');
const IMG_13 = require('../assets/exercises/13.webp');
const IMG_14 = require('../assets/exercises/14.webp');
const IMG_15 = require('../assets/exercises/15.webp');
const IMG_16 = require('../assets/exercises/16.webp');
const IMG_17 = require('../assets/exercises/17.webp');
const IMG_18 = require('../assets/exercises/18.webp');
const IMG_19 = require('../assets/exercises/19.webp');
const IMG_20 = require('../assets/exercises/20.webp');
const IMG_21 = require('../assets/exercises/21.webp');
const IMG_22 = require('../assets/exercises/22.webp');
const IMG_23 = require('../assets/exercises/23.webp');
const IMG_24 = require('../assets/exercises/24.webp');
const IMG_25 = require('../assets/exercises/25.webp');
const IMG_26 = require('../assets/exercises/26.webp');
const IMG_27 = require('../assets/exercises/27.webp');
const IMG_28 = require('../assets/exercises/28.webp');
const IMG_29 = require('../assets/exercises/29.webp');
const IMG_30 = require('../assets/exercises/30.webp');
const IMG_31 = require('../assets/exercises/31.webp');
const IMG_32 = require('../assets/exercises/32.webp');
const IMG_33 = require('../assets/exercises/33.webp');
const IMG_34 = require('../assets/exercises/34.webp');
const IMG_38 = require('../assets/exercises/38.webp');
const IMG_39 = require('../assets/exercises/39.webp');
const IMG_41 = require('../assets/exercises/41.webp');
const IMG_47 = require('../assets/exercises/47.webp');
const IMG_48 = require('../assets/exercises/48.webp');
const IMG_49 = require('../assets/exercises/49.webp');
const IMG_51 = require('../assets/exercises/51.webp');
const IMG_52 = require('../assets/exercises/52.webp');
const IMG_53 = require('../assets/exercises/53.webp');
const IMG_64 = require('../assets/exercises/64.webp');
const IMG_65 = require('../assets/exercises/65.webp');
const IMG_84 = require('../assets/exercises/84.webp');
const IMG_85 = require('../assets/exercises/85.webp');
const IMG_86 = require('../assets/exercises/86.webp');
const IMG_89 = require('../assets/exercises/89.webp');
const IMG_90 = require('../assets/exercises/90.webp');
const IMG_91 = require('../assets/exercises/91.webp');
const IMG_94 = require('../assets/exercises/94.webp');
const IMG_105 = require('../assets/exercises/105.webp');

/** Index 0..104 (exercisesEnUS.json) → require() result. Index i → (i+1).webp if exists, else fallback. */
const BUNDLED_BY_INDEX: (number | undefined)[] = [
  IMG_1,
  IMG_2,
  IMG_3,
  IMG_4,
  IMG_5,
  IMG_6,
  IMG_7,
  IMG_8,
  IMG_9,
  IMG_10,
  IMG_11,
  IMG_12,
  IMG_13,
  IMG_14,
  IMG_15,
  IMG_16,
  IMG_17,
  IMG_18,
  IMG_19,
  IMG_20,
  IMG_21,
  IMG_22,
  IMG_23,
  IMG_24,
  IMG_25,
  IMG_26,
  IMG_27,
  IMG_28,
  IMG_29,
  IMG_30,
  IMG_31,
  IMG_32,
  IMG_33,
  IMG_34,
  FALLBACK_IMAGE, // 35
  FALLBACK_IMAGE, // 36
  FALLBACK_IMAGE, // 37
  IMG_38,
  IMG_39,
  FALLBACK_IMAGE, // 40
  IMG_41,
  FALLBACK_IMAGE, // 42
  FALLBACK_IMAGE, // 43
  FALLBACK_IMAGE, // 44
  FALLBACK_IMAGE, // 45
  FALLBACK_IMAGE, // 46
  IMG_47,
  IMG_48,
  IMG_49,
  FALLBACK_IMAGE, // 50
  IMG_51,
  IMG_52,
  IMG_53,
  FALLBACK_IMAGE, // 54
  FALLBACK_IMAGE, // 55
  FALLBACK_IMAGE, // 56
  FALLBACK_IMAGE, // 57
  FALLBACK_IMAGE, // 58
  FALLBACK_IMAGE, // 59
  FALLBACK_IMAGE, // 60
  FALLBACK_IMAGE, // 61
  FALLBACK_IMAGE, // 62
  FALLBACK_IMAGE, // 63
  IMG_64,
  IMG_65,
  FALLBACK_IMAGE, // 66
  FALLBACK_IMAGE, // 67
  FALLBACK_IMAGE, // 68
  FALLBACK_IMAGE, // 69
  FALLBACK_IMAGE, // 70
  FALLBACK_IMAGE, // 71
  FALLBACK_IMAGE, // 72
  FALLBACK_IMAGE, // 73
  FALLBACK_IMAGE, // 74
  FALLBACK_IMAGE, // 75
  FALLBACK_IMAGE, // 76
  FALLBACK_IMAGE, // 77
  FALLBACK_IMAGE, // 78
  FALLBACK_IMAGE, // 79
  FALLBACK_IMAGE, // 80
  FALLBACK_IMAGE, // 81
  FALLBACK_IMAGE, // 82
  FALLBACK_IMAGE, // 83
  IMG_84,
  IMG_85,
  IMG_86,
  FALLBACK_IMAGE, // 87
  FALLBACK_IMAGE, // 88
  IMG_89,
  IMG_90,
  IMG_91,
  FALLBACK_IMAGE, // 92
  FALLBACK_IMAGE, // 93
  IMG_94,
  FALLBACK_IMAGE, // 95
  FALLBACK_IMAGE, // 96
  FALLBACK_IMAGE, // 97
  FALLBACK_IMAGE, // 98
  FALLBACK_IMAGE, // 99
  FALLBACK_IMAGE, // 100
  FALLBACK_IMAGE, // 101
  FALLBACK_IMAGE, // 102
  FALLBACK_IMAGE, // 103
  FALLBACK_IMAGE, // 104
  IMG_105,
];

/**
 * Returns the require() source for the exercise image at the given exercisesEnUS.json array index.
 * Used at seed time to copy the correct bundled image into document storage.
 */
export function getBundledExerciseImageSourceByIndex(index: number): number {
  if (index >= 0 && index < BUNDLED_BY_INDEX.length) {
    const source = BUNDLED_BY_INDEX[index];
    if (source != null) {
      return source;
    }
  }
  return FALLBACK_IMAGE;
}
