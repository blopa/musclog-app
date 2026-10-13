import type { MuscleGroupFamily } from '@/database/models/muscleGroupFamily';

/**
 * Whether the ranked suggestions belong on the tab the swap list is showing. They are substitutes
 * for the exercise being replaced, drawn from its own body region, so they are shown on "All" and on
 * that region's tab — on any other tab they would sit above a list of a different region and keep
 * their selection alive after the user moved away from it.
 */
export function suggestionsBelongOnTab(
  tab: 'all' | MuscleGroupFamily,
  currentFamily: MuscleGroupFamily | null
): boolean {
  return tab === 'all' || (currentFamily != null && tab === currentFamily);
}
