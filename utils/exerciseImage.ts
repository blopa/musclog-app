/**
 * Bundled exercise images by ID. Metro requires static require() paths,
 * so we explicitly require each asset. Use getExerciseImageSource or
 * getExerciseImageUri to resolve by exercise ID with fallback.
 */
const EXERCISE_IMAGES: Record<string, string> = {
  '1': require('../assets/exercises/1.webp'),
  '2': require('../assets/exercises/2.webp'),
  '3': require('../assets/exercises/3.webp'),
  '4': require('../assets/exercises/4.webp'),
  '5': require('../assets/exercises/5.webp'),
  '6': require('../assets/exercises/6.webp'),
  '7': require('../assets/exercises/7.webp'),
  '8': require('../assets/exercises/8.webp'),
  '9': require('../assets/exercises/9.webp'),
  '10': require('../assets/exercises/10.webp'),
  '11': require('../assets/exercises/11.webp'),
  '12': require('../assets/exercises/12.webp'),
  '13': require('../assets/exercises/13.webp'),
  '14': require('../assets/exercises/14.webp'),
  '15': require('../assets/exercises/15.webp'),
  '16': require('../assets/exercises/16.webp'),
  '17': require('../assets/exercises/17.webp'),
  '18': require('../assets/exercises/18.webp'),
  '19': require('../assets/exercises/19.webp'),
  '20': require('../assets/exercises/20.webp'),
  '21': require('../assets/exercises/21.webp'),
  '22': require('../assets/exercises/22.webp'),
  '23': require('../assets/exercises/23.webp'),
  '24': require('../assets/exercises/24.webp'),
  '25': require('../assets/exercises/25.webp'),
  '26': require('../assets/exercises/26.webp'),
  '27': require('../assets/exercises/27.webp'),
  '28': require('../assets/exercises/28.webp'),
  '29': require('../assets/exercises/29.webp'),
  '30': require('../assets/exercises/30.webp'),
  '31': require('../assets/exercises/31.webp'),
  '32': require('../assets/exercises/32.webp'),
  '33': require('../assets/exercises/33.webp'),
  '34': require('../assets/exercises/34.webp'),
  '38': require('../assets/exercises/38.webp'),
  '39': require('../assets/exercises/39.webp'),
  '41': require('../assets/exercises/41.webp'),
  '47': require('../assets/exercises/47.webp'),
  '48': require('../assets/exercises/48.webp'),
  '49': require('../assets/exercises/49.webp'),
  '51': require('../assets/exercises/51.webp'),
  '52': require('../assets/exercises/52.webp'),
  '53': require('../assets/exercises/53.webp'),
  '64': require('../assets/exercises/64.webp'),
  '65': require('../assets/exercises/65.webp'),
  '84': require('../assets/exercises/84.webp'),
  '85': require('../assets/exercises/85.webp'),
  '86': require('../assets/exercises/86.webp'),
  '89': require('../assets/exercises/89.webp'),
  '90': require('../assets/exercises/90.webp'),
  '91': require('../assets/exercises/91.webp'),
  '94': require('../assets/exercises/94.webp'),
  '105': require('../assets/exercises/105.webp'),
};

const FALLBACK_IMAGE = require('../assets/exercises/fallback.webp');

/**
 * Returns the require() source for the exercise image by ID.
 * Use for <ImageBackground source={...} /> or <Image source={...} />.
 */
export function getExerciseImageSource(exerciseId: string | undefined | null): string {
  if (exerciseId != null && EXERCISE_IMAGES[exerciseId] != null) {
    return EXERCISE_IMAGES[exerciseId];
  }

  return FALLBACK_IMAGE;
}
