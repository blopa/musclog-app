import type { FoodDiaryGrouping } from '@/constants/settings';
import type { MealType } from '@/database/models/NutritionLog';

import { CategoryGroupedDiary } from './CategoryGroupedDiary';
import type { DiaryCardsProps } from './DiaryCards';
import type { MacroTotals, MealGroup, ResolvedLogEntry } from './foodTypes';
import { TimeGroupedDiary } from './TimeGroupedDiary';

type MealSectionsListProps = DiaryCardsProps & {
  byMealType?: Partial<Record<MealType, Partial<MacroTotals>>>;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
  /** `categories` = one section per meal type; `time` = hourly sections. */
  grouping: FoodDiaryGrouping;
  /** BCP-47 tag used to format hours and times. */
  localeTag: string;
};

export function MealSectionsList({
  byMealType,
  grouping,
  localeTag,
  ...diary
}: MealSectionsListProps) {
  return grouping === 'time' ? (
    <TimeGroupedDiary {...diary} localeTag={localeTag} />
  ) : (
    <CategoryGroupedDiary {...diary} byMealType={byMealType} />
  );
}
