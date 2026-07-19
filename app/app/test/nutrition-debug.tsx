import { Plus, Scale, Search, Utensils } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { FilterTabs } from '@/components/FilterTabs';
import { MasterLayout } from '@/components/MasterLayout';
import { DatePickerInput } from '@/components/modals/DatePickerInput';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { FoodSearchModal } from '@/components/modals/FoodSearchModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import type { MealType } from '@/database/models/NutritionLog';
import { FoodService, NutritionService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';
import type { UnifiedFoodResult } from '@/hooks/useUnifiedFoodSearch';
import { localCalendarDayDate, withCurrentTimeOnDay } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { showSnackbar } from '@/utils/snackbarService';

const MEAL_TABS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
  { id: 'other', label: 'Other' },
];

/** Whole calendar days from `start` to `end` inclusive (both normalized to local midnight). */
function inclusiveDayCount(start: Date, end: Date): number {
  const startMs = localCalendarDayDate(start).getTime();
  const endMs = localCalendarDayDate(end).getTime();
  if (endMs < startMs) {
    return 0;
  }
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

/**
 * Resolve a picked search result to a persisted `foods` row id. Local results already point at a
 * real row; external ones (OFF / USDA) carry only per-100g macros, so we materialize a lightweight
 * custom food from them. Fidelity of micros is intentionally not preserved — this is a debug seeder.
 */
async function resolveFoodId(food: UnifiedFoodResult): Promise<string> {
  if (food.source === 'local') {
    return food.id;
  }

  const created = await FoodService.createCustomFood(
    food.name || 'Debug food',
    {
      calories: food.calories ?? 0,
      protein: food.protein ?? 0,
      carbs: food.carbs ?? 0,
      fat: food.fat ?? 0,
      fiber: food.fiber ?? 0,
    },
    food.brand
  );
  return created.id;
}

type BulkTrackModalProps = {
  visible: boolean;
  food: UnifiedFoodResult | null;
  onClose: () => void;
  onTracked: (count: number) => void;
};

function BulkTrackFoodModal({ visible, food, onClose, onTracked }: BulkTrackModalProps) {
  const theme = useTheme();
  const [startDate, setStartDate] = useState(() => localCalendarDayDate(new Date()));
  const [endDate, setEndDate] = useState(() => localCalendarDayDate(new Date()));
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [weightText, setWeightText] = useState('100');
  const [isStartPickerVisible, setIsStartPickerVisible] = useState(false);
  const [isEndPickerVisible, setIsEndPickerVisible] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const weight = useMemo(() => {
    const parsed = Number(weightText.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [weightText]);

  const dayCount = useMemo(() => inclusiveDayCount(startDate, endDate), [startDate, endDate]);

  const canTrack =
    !!food && dayCount > 0 && dayCount <= 366 && Number.isFinite(weight) && weight > 0;

  const handleTrack = useCallback(async () => {
    if (!food || !canTrack) {
      return;
    }

    setIsTracking(true);
    try {
      const foodId = await resolveFoodId(food);

      let count = 0;
      const cursor = localCalendarDayDate(startDate);
      const lastMs = localCalendarDayDate(endDate).getTime();
      while (cursor.getTime() <= lastMs) {
        // `nutrition_logs.date` is a consumed datetime; stamp the chosen day with "now".
        const consumedAt = withCurrentTimeOnDay(localCalendarDayDate(cursor));
        await NutritionService.logFood(foodId, consumedAt, mealType, weight);
        count += 1;
        cursor.setDate(cursor.getDate() + 1);
      }

      onTracked(count);
    } catch (err) {
      handleError(err, 'NutritionDebug.bulkTrack', {
        snackbarMessage: 'Failed to bulk-track food',
      });
    } finally {
      setIsTracking(false);
    }
  }, [food, canTrack, startDate, endDate, mealType, weight, onTracked]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Bulk track food"
      scrollable
      footer={
        <View className="pb-6">
          <Button
            label={dayCount > 0 ? `Track for ${dayCount} day(s)` : 'Track'}
            icon={Plus}
            variant="gradientCta"
            size="sm"
            width="full"
            onPress={handleTrack}
            disabled={!canTrack || isTracking}
            loading={isTracking}
          />
        </View>
      }
    >
      <View className="gap-6 p-4">
        {/* Picked food summary */}
        <GenericCard variant="default">
          <View className="flex-row items-center gap-3 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
              <Utensils size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold text-text-primary" numberOfLines={1}>
                {food?.name || 'No food selected'}
              </Text>
              <Text className="text-xs text-text-tertiary" numberOfLines={1}>
                {food
                  ? `${food.source} · ${Math.round(food.calories ?? 0)} kcal / 100g`
                  : 'Pick a food first'}
              </Text>
            </View>
          </View>
        </GenericCard>

        {/* Date range */}
        <View className="gap-3">
          <DatePickerInput
            label="Start date"
            selectedDate={startDate}
            onPress={() => setIsStartPickerVisible(true)}
            variant="default"
          />
          <DatePickerInput
            label="End date"
            selectedDate={endDate}
            onPress={() => setIsEndPickerVisible(true)}
            variant="default"
          />
          {dayCount > 366 ? (
            <Text className="text-status-error text-xs font-medium">
              Range too large ({dayCount} days). Max 366.
            </Text>
          ) : null}
          {dayCount === 0 ? (
            <Text className="text-status-error text-xs font-medium">
              End date must be on or after the start date.
            </Text>
          ) : null}
        </View>

        {/* Meal type */}
        <View>
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
            Meal
          </Text>
          <FilterTabs
            tabs={MEAL_TABS}
            activeTab={mealType}
            onTabChange={(id) => setMealType(id as MealType)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>

        {/* Weight */}
        <TextInput
          label="Weight (g)"
          value={weightText}
          onChangeText={setWeightText}
          placeholder="100"
          keyboardType="numeric"
          icon={<Scale size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
        />
      </View>

      {isStartPickerVisible ? (
        <DatePickerModal
          visible={isStartPickerVisible}
          onClose={() => setIsStartPickerVisible(false)}
          selectedDate={startDate}
          onDateSelect={(date) => {
            const day = localCalendarDayDate(date);
            setStartDate(day);
            // Keep the range valid: pull the end forward if it now precedes the start.
            setEndDate((prev) => (prev.getTime() < day.getTime() ? day : prev));
            setIsStartPickerVisible(false);
          }}
        />
      ) : null}

      {isEndPickerVisible ? (
        <DatePickerModal
          visible={isEndPickerVisible}
          onClose={() => setIsEndPickerVisible(false)}
          selectedDate={endDate}
          minDate={startDate}
          onDateSelect={(date) => {
            setEndDate(localCalendarDayDate(date));
            setIsEndPickerVisible(false);
          }}
        />
      ) : null}
    </FullScreenModal>
  );
}

export default function NutritionDebugScreen() {
  const theme = useTheme();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [pickedFood, setPickedFood] = useState<UnifiedFoodResult | null>(null);
  const [isBulkTrackVisible, setIsBulkTrackVisible] = useState(false);

  // Keep the search modal mounted so the bulk-track modal is presented from its controller
  // (iOS presenter safety — see docs/modals-problem-on-ios.md).
  const handleFoodPicked = useCallback((food: UnifiedFoodResult) => {
    setPickedFood(food);
    setIsBulkTrackVisible(true);
  }, []);

  const closeAll = useCallback(() => {
    setIsBulkTrackVisible(false);
    setIsSearchVisible(false);
    setPickedFood(null);
  }, []);

  const handleTracked = useCallback(
    (count: number) => {
      closeAll();
      showSnackbar('success', `Tracked ${count} log(s)`);
    },
    [closeAll]
  );

  return (
    <MasterLayout>
      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
      >
        <View>
          <Text className="text-2xl font-bold text-text-primary">Nutrition Debug</Text>
          <Text className="mt-1 text-xs text-text-tertiary">
            Seed nutrition logs across a date range for QA
          </Text>
        </View>

        <GenericCard variant="default">
          <View className="gap-3 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
                <Utensils size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-text-primary">Bulk track a food</Text>
                <Text className="text-xs text-text-tertiary">
                  Pick a food, then a date range, meal, and weight.
                </Text>
              </View>
            </View>

            <Button
              label="Search food"
              icon={Search}
              size="sm"
              variant="secondary"
              onPress={() => setIsSearchVisible(true)}
            />
          </View>
        </GenericCard>
      </ScrollView>

      <FoodSearchModal visible={isSearchVisible} onClose={closeAll} onFoodPicked={handleFoodPicked}>
        <BulkTrackFoodModal
          visible={isBulkTrackVisible}
          food={pickedFood}
          onClose={() => {
            // Cancel: drop the picked food and fall back to the still-open search modal.
            setIsBulkTrackVisible(false);
            setPickedFood(null);
          }}
          onTracked={handleTracked}
        />
      </FoodSearchModal>
    </MasterLayout>
  );
}
