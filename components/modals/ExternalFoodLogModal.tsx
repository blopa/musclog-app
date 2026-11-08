import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { PasteJsonSheet } from '@/components/aiOnboarding/PasteJsonSheet';
import { FoodInfoCard } from '@/components/cards/FoodInfoCard';
import { ExternalAssistantHandoff } from '@/components/externalAssistant/ExternalAssistantHandoff';
import { FilterTabs } from '@/components/FilterTabs';
import { inferMealTypeFromHour } from '@/components/nutrition/foodDiaryLayout';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useSnackbar } from '@/context/SnackbarContext';
import type { MealType } from '@/database/models/NutritionLog';
import {
  EMPTY_IMPORT_ERROR_KEY,
  type ExternalHandoffCopy,
  SHARED_HANDOFF_COPY,
  useExternalAssistantImport,
} from '@/hooks/useExternalAssistantImport';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import type { IncomingOpenLink } from '@/hooks/useOpenLinkHandler';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalState, useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import {
  loadFoodLogInstructions,
  logExternalFoods,
  readExternalFoodLog,
} from '@/services/externalFoodLog';
import {
  type FoodLogParseError,
  MAX_FOOD_LOG_BYTES,
  MEAL_NAME_MAX,
} from '@/utils/aiFoodLog/contract';
import {
  canGroupFoods,
  defaultGrouping,
  type FoodLogGrouping,
  type FoodLogIngredient,
  sumIngredients,
} from '@/utils/aiFoodLog/logPlan';
import { blurFilter } from '@/utils/blurFilter';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

/** What the person is told for each way an imported file can be unusable. */
const IMPORT_ERROR_KEYS: Record<FoodLogParseError, string> = {
  empty: EMPTY_IMPORT_ERROR_KEY,
  tooLarge: 'food.externalLog.errors.tooLarge',
  notJson: 'food.externalLog.errors.notJson',
  notAnObject: 'food.externalLog.errors.notJson',
  wrongSchema: 'food.externalLog.errors.wrongSchema',
  invalidVersion: 'food.externalLog.errors.wrongSchema',
  newerVersion: 'food.externalLog.errors.newerVersion',
  invalidLog: 'food.externalLog.errors.invalidLog',
  noFoods: 'food.externalLog.errors.noFoods',
};

const HANDOFF_COPY: ExternalHandoffCopy = {
  ...SHARED_HANDOFF_COPY,
  intro: 'food.externalLog.intro',
  steps: [
    'food.externalLog.steps.one',
    'food.externalLog.steps.two',
    'food.externalLog.steps.three',
  ],
  backSection: 'food.externalLog.backSection',
  importFile: 'food.externalLog.importFile',
  noFile: 'food.externalLog.noFile',
  tooLarge: IMPORT_ERROR_KEYS.tooLarge,
  linkError: 'food.externalLog.linkError',
};

type ExternalFoodLogModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The day the food is logged on until the person picks another (the diary's selected day). */
  logDate: Date;
  /**
   * The meal pre-selected when the assistant does not say which one it was, e.g. the diary section
   * Add food was opened from. Left out, the meal follows the time of day.
   */
  initialMealType?: MealType;
  /** Called once the food is logged, so the screen behind can refresh. */
  onLogged?: () => void;
  /**
   * The text of a tapped open link (`/open#food=…`). Read once per `key`: success opens the review
   * directly (on `logDate`, the diary's selected day), failure explains why on the first step.
   */
  incoming?: IncomingOpenLink | null;
};

/** What the person is reviewing: the foods that can be logged and how they will be logged. */
type Review = {
  ingredients: FoodLogIngredient[];
  skippedFoods: number;
  unresolvedNames: string[];
  grouping: FoodLogGrouping;
  date: Date;
  time: Date;
  mealType: MealType;
};

/**
 * The title over the totals: the meal's name when the foods are grouped under one, the food's own
 * name when there is just one, and otherwise a label for the lot.
 */
function summaryNameFor(
  ingredients: readonly FoodLogIngredient[],
  groupedMealName: string,
  fallback: string
): string {
  const mealName = groupedMealName.trim();
  if (mealName) {
    return mealName;
  }

  return ingredients.length === 1 ? ingredients[0].name : fallback;
}

/**
 * Tracks food with ChatGPT or Claude outside the app: the instructions (rules, schema and, when
 * the person allows it, the foundation foods Musclog can match) are copied, the assistant works
 * out what was eaten and writes a JSON file, and the file comes back here by import or paste.
 * Nothing is saved until the person has reviewed what was understood and chosen the day, time and
 * meal, and several foods can be logged as separate entries or as one meal.
 */
export function ExternalFoodLogModal({
  visible,
  onClose,
  logDate,
  initialMealType,
  onLogged,
  incoming = null,
}: ExternalFoodLogModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();
  const { intuitiveEatingMode } = useSettings();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  // These reset on their own when the parent closes, so no stale review or open picker survives
  // behind a closed modal.
  const [review, setReview] = useSubModalState<Review | null>(visible, null);
  const [showDatePicker, setShowDatePicker] = useSubModalVisibility(visible);
  const [showTimePicker, setShowTimePicker] = useSubModalVisibility(visible);
  const [isLogging, setIsLogging] = useState(false);

  /** Reads imported text; on success the review opens. Returns the problem to show, if any. */
  const accept = async (text: string): Promise<string | null> => {
    try {
      const result = await readExternalFoodLog(text);
      if (!result.ok) {
        return t(IMPORT_ERROR_KEYS[result.error]);
      }

      // Read once, here: render must stay pure and "now" is the usual time for a meal.
      const now = new Date();
      setReview({
        ingredients: result.ingredients,
        skippedFoods: result.skippedFoods,
        unresolvedNames: result.unresolvedNames,
        grouping: defaultGrouping(result.ingredients.length, result.log.mealName),
        date: localCalendarDayDate(logDate),
        time: now,
        mealType: result.log.mealType ?? initialMealType ?? inferMealTypeFromHour(now.getHours()),
      });
      return null;
    } catch (error) {
      handleError(error, 'ExternalFoodLogModal.accept');
      return t('food.externalLog.errors.lookup');
    }
  };

  const handoff = useExternalAssistantImport({
    // The prompt can carry the foundation foods list, so a prefilled link is often too long; the
    // clipboard copy is what always works.
    buildInstructions: () => loadFoodLogInstructions(locale),
    maxBytes: MAX_FOOD_LOG_BYTES,
    accept,
    copy: HANDOFF_COPY,
    scope: 'ExternalFoodLogModal',
    visible,
    incoming,
  });

  const close = () => {
    handoff.reset();
    onClose();
  };

  const updateReview = (patch: Partial<Review>) =>
    setReview((current) => (current ? { ...current, ...patch } : current));

  const removeFood = (index: number) => {
    if (!review) {
      return;
    }

    const ingredients = review.ingredients.filter((_, position) => position !== index);
    // Removing the last food leaves nothing to log, so the person is back at the import step.
    setReview(ingredients.length === 0 ? null : { ...review, ingredients });
  };

  const log = async () => {
    if (!review || isLogging) {
      return;
    }

    setIsLogging(true);
    try {
      await logExternalFoods({
        ingredients: review.ingredients,
        date: review.date,
        time: review.time,
        mealType: review.mealType,
        grouping: review.grouping,
      });
      showSnackbar(
        'success',
        t('food.externalLog.review.logged', { count: review.ingredients.length })
      );
      onLogged?.();
      close();
    } catch (error) {
      handleError(error, 'ExternalFoodLogModal.log');
      showSnackbar('error', t('food.externalLog.review.logError'));
    } finally {
      setIsLogging(false);
    }
  };

  const textStyle = (color: string, size: number) => ({ color, fontSize: size });

  const renderReview = (current: Review) => {
    const { ingredients, grouping } = current;
    const totals = sumIngredients(ingredients);
    const canGroup = canGroupFoods(ingredients.length);
    const summaryName = summaryNameFor(
      ingredients,
      canGroup && grouping.group ? grouping.mealName : '',
      t('food.externalLog.review.totalLabel')
    );

    return (
      <View className="gap-6 px-4 pb-6 pt-4">
        <Text style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.base)}>
          {t('food.externalLog.review.intro')}
        </Text>

        <FoodInfoCard
          food={{
            name: summaryName,
            category: t('food.externalLog.review.foodCount', { count: ingredients.length }),
            calories: totals.kcal,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            source: 'ai',
          }}
          intuitiveMode={intuitiveEatingMode}
        />

        <View className="gap-2">
          <SectionLabel>{t('food.externalLog.review.foodsLabel')}</SectionLabel>
          {ingredients.map((ingredient, index) => (
            <View
              key={`${ingredient.name}-${index}`}
              className="flex-row items-center gap-2 rounded-control py-1 pl-3 pr-1"
              style={{ backgroundColor: theme.colors.background.ink5 }}
            >
              <View className="min-w-0 flex-1 py-1.5">
                <Text
                  style={{
                    ...textStyle(theme.colors.text.primary, theme.typography.fontSize.base),
                    fontWeight: theme.typography.fontWeight.semibold,
                  }}
                >
                  {ingredient.name}
                </Text>
                <Text
                  className="tabular-nums"
                  style={{
                    ...textStyle(theme.colors.text.secondary, theme.typography.fontSize.sm),
                    ...(intuitiveEatingMode ? blurFilter(4) : {}),
                  }}
                >
                  {t('food.externalLog.review.item', {
                    grams: formatRoundedDecimal(ingredient.grams, 1),
                    kcal: formatInteger(Math.round(ingredient.kcal)),
                  })}
                </Text>
              </View>
              <View className="shrink-0">
                <IconButton
                  icon={X}
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={t('food.externalLog.review.remove', {
                    name: ingredient.name,
                  })}
                  onPress={() => removeFood(index)}
                  disabled={isLogging}
                />
              </View>
            </View>
          ))}
        </View>

        {current.unresolvedNames.length > 0 ? (
          <Text style={textStyle(theme.colors.status.warning, theme.typography.fontSize.sm)}>
            {t('food.externalLog.review.unresolved', {
              count: current.unresolvedNames.length,
              names: current.unresolvedNames.join(', '),
            })}
          </Text>
        ) : null}
        {current.skippedFoods > 0 ? (
          <Text style={textStyle(theme.colors.status.warning, theme.typography.fontSize.sm)}>
            {t('food.externalLog.review.skipped', { count: current.skippedFoods })}
          </Text>
        ) : null}

        {canGroup ? (
          <View>
            <ToggleInput
              items={[
                {
                  key: 'group',
                  label: t('food.externalLog.review.groupTitle'),
                  subtitle: t('food.externalLog.review.groupSubtitle'),
                  value: grouping.group,
                  onValueChange: (group) => updateReview({ grouping: { ...grouping, group } }),
                },
              ]}
            />
            {grouping.group ? (
              <TextInput
                label={t('food.externalLog.review.mealNameLabel')}
                value={grouping.mealName}
                onChangeText={(mealName) => updateReview({ grouping: { ...grouping, mealName } })}
                placeholder={t('food.externalLog.review.mealNamePlaceholder')}
                maxLength={MEAL_NAME_MAX}
              />
            ) : null}
          </View>
        ) : null}

        <DatePickerInput
          selectedDate={current.date}
          onPress={() => setShowDatePicker(true)}
          label={t('food.foodDetails.date')}
          variant="default"
        />
        <TimePickerInput
          selectedTime={current.time}
          onPress={() => setShowTimePicker(true)}
          variant="default"
        />

        <View>
          <Text
            className="mb-3 text-xs font-semibold"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('meals.mealType')}
          </Text>
          <FilterTabs
            tabs={[
              { id: 'breakfast', label: t('food.meals.breakfast') },
              { id: 'lunch', label: t('food.meals.lunch') },
              { id: 'dinner', label: t('food.meals.dinner') },
              { id: 'snack', label: t('food.meals.snacks') },
              { id: 'other', label: t('food.meals.other') },
            ]}
            activeTab={current.mealType}
            onTabChange={(mealType) => updateReview({ mealType: mealType as MealType })}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>

        <Button
          label={t('food.externalLog.review.differentFile')}
          variant="outline"
          width="full"
          disabled={isLogging}
          onPress={() => setReview(null)}
        />
      </View>
    );
  };

  const footer = review ? (
    <Button
      label={t('food.externalLog.review.log', { count: review.ingredients.length })}
      variant="accent"
      width="full"
      loading={isLogging}
      disabled={isLogging}
      onPress={log}
    />
  ) : undefined;

  return (
    <FullScreenModal
      visible={visible}
      onClose={close}
      title={t('food.externalLog.title')}
      footer={footer}
      closable={!isLogging}
    >
      {review ? (
        renderReview(review)
      ) : (
        <ExternalAssistantHandoff copy={HANDOFF_COPY} handoff={handoff} />
      )}

      <PasteJsonSheet
        {...handoff.pasteSheetProps}
        title={t('food.externalLog.paste.title')}
        subtitle={t('food.externalLog.paste.subtitle')}
        placeholder={t('food.externalLog.paste.placeholder')}
      />

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={review?.date ?? logDate}
        onDateSelect={(date) => {
          updateReview({ date: localCalendarDayDate(date) });
          setShowDatePicker(false);
        }}
      />
      <TimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        selectedTime={review?.time ?? logDate}
        title={t('timePicker.selectTime')}
        onTimeSelect={(time) => updateReview({ time })}
      />
    </FullScreenModal>
  );
}
