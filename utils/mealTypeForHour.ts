import type { TrackedMeal } from './coachAI';

/** The meal something eaten or photographed at this hour most likely belongs to (a photo's review screen and the diary's "add" button let the person change it). */
export function mealTypeForHour(hour: number): TrackedMeal['mealType'] {
  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  }

  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }

  return hour >= 15 && hour < 22 ? 'dinner' : 'snack';
}
