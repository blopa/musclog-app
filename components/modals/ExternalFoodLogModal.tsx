import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, Copy, FileUp, Share2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { PasteJsonSheet } from '@/components/aiOnboarding/PasteJsonSheet';
import { FoodInfoCard } from '@/components/cards/FoodInfoCard';
import { FilterTabs } from '@/components/FilterTabs';
import { inferMealTypeFromHour } from '@/components/nutrition/foodDiaryLayout';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useSnackbar } from '@/context/SnackbarContext';
import type { MealType } from '@/database/models/NutritionLog';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useNativeShareText } from '@/hooks/useNativeShareText';
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
import { buildExternalChatUrl, type ExternalTarget } from '@/utils/aiOnboarding/instructions';
import { blurFilter } from '@/utils/blurFilter';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { pickTextFile } from '@/utils/pickTextFile';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

/** What the person is told for each way an imported file can be unusable. */
const IMPORT_ERROR_KEYS: Record<FoodLogParseError, string> = {
  empty: 'food.externalLog.errors.empty',
  tooLarge: 'food.externalLog.errors.tooLarge',
  notJson: 'food.externalLog.errors.notJson',
  notAnObject: 'food.externalLog.errors.notJson',
  wrongSchema: 'food.externalLog.errors.wrongSchema',
  invalidVersion: 'food.externalLog.errors.wrongSchema',
  newerVersion: 'food.externalLog.errors.newerVersion',
  invalidLog: 'food.externalLog.errors.invalidLog',
  noFoods: 'food.externalLog.errors.noFoods',
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
  const { shareText } = useNativeShareText();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();
  const { intuitiveEatingMode } = useSettings();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  // These three reset on their own when the parent closes, so no stale review or open picker
  // survives behind a closed modal.
  const [review, setReview] = useSubModalState<Review | null>(visible, null);
  const [pasteOpen, setPasteOpen] = useSubModalVisibility(visible);
  const [showDatePicker, setShowDatePicker] = useSubModalVisibility(visible);
  const [showTimePicker, setShowTimePicker] = useSubModalVisibility(visible);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const isReading = useRef(false);
  const handledLinkKey = useRef<number | null>(null);

  const copyInstructions = async (): Promise<string | null> => {
    try {
      const instructions = await loadFoodLogInstructions(locale);
      await Clipboard.setStringAsync(instructions);
      return instructions;
    } catch (error) {
      handleError(error, 'ExternalFoodLogModal.copy');
      return null;
    }
  };

  const open = async (target: ExternalTarget) => {
    setFallbackNotice(false);
    const instructions = await copyInstructions();
    if (!instructions) {
      setFallbackNotice(true);
      return;
    }

    showSnackbar('success', t('food.externalLog.copiedPaste'), { duration: 4000 });
    try {
      // The prompt can carry the foundation foods list, so a prefilled link is often too long; the
      // clipboard copy above is what always works.
      await Linking.openURL(buildExternalChatUrl(target, instructions).url);
    } catch {
      setFallbackNotice(true);
    }
  };

  const copyOnly = async () => {
    setFallbackNotice(false);
    if (await copyInstructions()) {
      showSnackbar('success', t('food.externalLog.copied'));
    } else {
      setFallbackNotice(true);
    }
  };

  const share = async () => {
    try {
      await shareText(await loadFoodLogInstructions(locale));
    } catch (error) {
      handleError(error, 'ExternalFoodLogModal.share');
    }
  };

  /** Reads imported text; on success the review opens. Returns the problem to show, if any. */
  const accept = async (text: string): Promise<string | null> => {
    if (isReading.current) {
      return null;
    }

    isReading.current = true;
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
    } finally {
      isReading.current = false;
    }
  };

  // The newest link wins, replacing a review that is already open. Run through a named helper so
  // the state updates are not set directly in the effect body.
  const acceptIncoming = async (link: IncomingOpenLink) => {
    const problem = await accept(link.text);
    setLinkError(problem ? t('food.externalLog.linkError', { reason: problem }) : null);
  };

  useEffect(() => {
    if (!visible || !incoming || handledLinkKey.current === incoming.key) {
      return;
    }

    handledLinkKey.current = incoming.key;
    void acceptIncoming(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the link, not on the handlers
  }, [visible, incoming]);

  const importFile = async () => {
    setFileError(null);
    setLinkError(null);
    try {
      const picked = await pickTextFile({ maxBytes: MAX_FOOD_LOG_BYTES });
      if (picked.status === 'cancelled') {
        return;
      }

      setFileError(
        picked.status === 'tooLarge' ? t(IMPORT_ERROR_KEYS.tooLarge) : await accept(picked.text)
      );
    } catch (error) {
      handleError(error, 'ExternalFoodLogModal.importFile');
      setFileError(t('food.externalLog.errors.fileRead'));
    }
  };

  const submitPasted = async (text: string) => {
    const error = await accept(text);
    setPasteError(error);
    if (!error) {
      setPasteOpen(false);
    }
  };

  const close = () => {
    setFileError(null);
    setLinkError(null);
    setFallbackNotice(false);
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

  const steps = [
    'food.externalLog.steps.one',
    'food.externalLog.steps.two',
    'food.externalLog.steps.three',
  ] as const;

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
        <View className="gap-6 px-4 pb-12 pt-4">
          <View className="gap-2">
            <Text style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.base)}>
              {t('food.externalLog.intro')}
            </Text>
            {steps.map((key, index) => (
              <Text
                key={key}
                style={textStyle(theme.colors.text.primary, theme.typography.fontSize.base)}
              >
                {`${formatInteger(index + 1)}. ${t(key)}`}
              </Text>
            ))}
          </View>

          {linkError ? (
            <Text style={textStyle(theme.colors.status.error, theme.typography.fontSize.sm)}>
              {linkError}
            </Text>
          ) : null}

          <View className="gap-3">
            <SectionLabel>{t('food.externalLog.leaveSection')}</SectionLabel>
            <Button
              label={t('food.externalLog.openChatgpt')}
              variant="accent"
              width="full"
              onPress={() => open('chatgpt')}
            />
            <Button
              label={t('food.externalLog.openClaude')}
              variant="accent"
              width="full"
              onPress={() => open('claude')}
            />
            <View className="flex-row flex-wrap gap-3">
              <Button
                label={t('food.externalLog.copy')}
                icon={Copy}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={copyOnly}
              />
              <Button
                label={t('food.externalLog.share')}
                icon={Share2}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={share}
              />
            </View>
            {fallbackNotice ? (
              <Text style={textStyle(theme.colors.status.error, theme.typography.fontSize.sm)}>
                {t('food.externalLog.fallback')}
              </Text>
            ) : null}
            <Text style={textStyle(theme.colors.text.tertiary, theme.typography.fontSize.sm)}>
              {t('food.externalLog.privacy')}
            </Text>
          </View>

          <View className="gap-3">
            <SectionLabel>{t('food.externalLog.backSection')}</SectionLabel>
            <Button
              label={t('food.externalLog.importFile')}
              icon={FileUp}
              variant="accent"
              width="full"
              onPress={importFile}
            />
            {fileError ? (
              <Text style={textStyle(theme.colors.status.error, theme.typography.fontSize.sm)}>
                {fileError}
              </Text>
            ) : null}
            <Button
              label={t('food.externalLog.pasteJson')}
              icon={ClipboardPaste}
              variant="outline"
              width="full"
              onPress={() => {
                setPasteError(null);
                setLinkError(null);
                setPasteOpen(true);
              }}
            />
            <Text style={textStyle(theme.colors.text.tertiary, theme.typography.fontSize.sm)}>
              {t('food.externalLog.noFile')}
            </Text>
          </View>
        </View>
      )}

      <PasteJsonSheet
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onSubmit={submitPasted}
        error={pasteError}
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
