import {
  CalendarCheck,
  Info,
  PencilLine,
  Scale,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react-native';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { StatStrip } from '@/components/StatStrip';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { nutritionTargetMode } from '@/database/services/NutritionTargetService';
import {
  MIN_WEEKLY_FOOD_DAYS,
  MIN_WEEKLY_WEIGHT_ENTRIES,
  type WeeklyReviewService,
} from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localDayKeyPlusCalendarDays, localDayStartFromUtcMs } from '@/utils/calendarDate';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import { hasWeeklyActivity, nutritionHalfState } from '@/utils/weeklyReviewEmptyState';

import {
  calorieChangeShare,
  isBelowCalorieFloor,
  isLargeCalorieChange,
  nutritionReason,
} from './nutritionReason';
import { ReviewSectionHeader } from './TrainingReviewSection';

type Overview = Awaited<ReturnType<typeof WeeklyReviewService.overview>>;

export const MACRO_FIELDS = ['totalCalories', 'protein', 'carbs', 'fats', 'fiber'] as const;

export const MACRO_LABEL_KEYS = {
  totalCalories: 'weeklyReview.macros.totalCalories',
  protein: 'weeklyReview.macros.protein',
  carbs: 'weeklyReview.macros.carbs',
  fats: 'weeklyReview.macros.fats',
  fiber: 'weeklyReview.macros.fiber',
} as const satisfies Record<(typeof MACRO_FIELDS)[number], string>;

const MODE_KEYS = {
  manual: 'weeklyReview.modes.manual',
  daily: 'weeklyReview.modes.daily',
  weekly: 'weeklyReview.modes.weekly',
} as const;

/**
 * The Nutrition half of a Weekly Review: this week's evidence, the recommended targets beside the
 * current ones, and the decision. Approved targets start tomorrow and stay put until the next
 * review; keeping the current ones is always a first-class answer.
 */
export function NutritionReviewSection({
  data,
  busy,
  onApply,
  onKeep,
  onEdit,
  onSwitchWeekly,
  onEditGoal,
  onLogWeight,
  onLogFood,
  onLogFirstMeal,
}: {
  data: Overview;
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
  onEdit: () => void;
  onSwitchWeekly: () => void;
  onEditGoal: () => void;
  /** Opens weight entry on `day` (local midnight), a day of the reviewed week with no weigh-in. */
  onLogWeight: (day: number) => void;
  /** Opens the food diary on `day` (local midnight), a day of the reviewed week with no food. */
  onLogFood: (day: number) => void;
  /** Opens today's food diary: a first meal belongs to the week being built, not the one reviewed. */
  onLogFirstMeal: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { locale, formatInteger, formatNumber } = useFormatAppNumber();
  if (data.intuitive) {
    return (
      <View className="rounded-2xl border border-border-light bg-bg-card p-4">
        <Text className="text-sm text-text-secondary">{t('weeklyReview.intuitive')}</Text>
      </View>
    );
  }

  if (!data.goal || !data.current) {
    return (
      <View
        className="gap-2 rounded-2xl border border-border-light bg-bg-card p-4"
        testID="review-nutrition"
      >
        <ReviewSectionHeader
          title={t('weeklyReview.nutrition')}
          icon={Utensils}
          done={hasWeeklyActivity(data.activity) ? false : null}
        />
        <Text className="text-sm text-text-secondary">{t('weeklyReview.noGoal')}</Text>
      </View>
    );
  }

  const mode = nutritionTargetMode(data.goal);
  const recommendation = data.nutrition;
  const decided = !!data.review?.nutritionReviewedAt;
  const signed = (value: number) =>
    formatNumber(value, { signDisplay: 'exceptZero', maximumFractionDigits: 0 });
  const date = (value: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
      value
    );

  const weightUnit = t(getWeightUnitI18nKey(units));
  const why = nutritionReason(recommendation);
  let reason: string;
  if ('trendChangeKg' in why) {
    reason = t(why.key, {
      expenditure: formatInteger(why.expenditure),
      change: `${formatNumber(kgToDisplay(why.trendChangeKg, units), {
        signDisplay: 'exceptZero',
        maximumFractionDigits: 1,
      })} ${weightUnit}`,
    });
  } else if ('expenditure' in why) {
    reason = t(why.key, { expenditure: formatInteger(why.expenditure) });
  } else {
    // `collectData` states the thresholds `canApply` checks, so the copy cannot drift from them.
    reason = t(why.key, {
      food: formatInteger(MIN_WEEKLY_FOOD_DAYS),
      weight: formatInteger(MIN_WEEKLY_WEIGHT_ENTRIES),
    });
  }

  const largeChange =
    !decided &&
    !!recommendation &&
    isLargeCalorieChange(data.current.totalCalories, recommendation.targets.totalCalories);
  const belowFloor = !decided && isBelowCalorieFloor(recommendation);
  // Until the week has enough evidence the recommendation is an estimate: shown, but not offered.
  const estimate = !decided && !!recommendation && !recommendation.canApply;
  let recommendedColumnKey:
    'weeklyReview.savedShort' | 'weeklyReview.estimateShort' | 'weeklyReview.recommended' =
    'weeklyReview.recommended';
  if (decided) {
    recommendedColumnKey = 'weeklyReview.savedShort';
  } else if (estimate) {
    recommendedColumnKey = 'weeklyReview.estimateShort';
  }

  const applied = data.review?.nutritionDecision === 'apply';
  const decidedBlock = (
    <View className="flex-row items-start gap-3 rounded-xl bg-accent-primary/10 p-3">
      <CalendarCheck size={theme.iconSize.md} color={theme.colors.accent.primary} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-base font-bold text-text-primary">
          {t(applied ? 'weeklyReview.applied' : 'weeklyReview.kept')}
        </Text>
        {applied && data.review?.nutritionReviewedAt ? (
          <Text className="text-sm text-text-secondary">
            {t('weeklyReview.effective', {
              // Approved targets start the next local calendar day (see `WeeklyReviewService.decide`);
              // adding 24 hours lands on the wrong day across a daylight-saving change.
              date: date(
                localDayKeyPlusCalendarDays(
                  localDayStartFromUtcMs(data.review.nutritionReviewedAt),
                  1
                )
              ),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const state = nutritionHalfState(data.activity);
  if (state !== 'data') {
    return (
      <NutritionEmptyState
        data={data}
        first={state === 'first'}
        busy={busy}
        decided={decided}
        decidedBlock={decidedBlock}
        logFoodLabel={t('weeklyReview.logFoodOn', { date: date(data.period.start) })}
        onKeep={onKeep}
        onEditGoal={onEditGoal}
        onLogFood={() => onLogFood(data.period.start)}
        onLogFirstMeal={onLogFirstMeal}
      />
    );
  }

  let decision;
  if (decided) {
    decision = decidedBlock;
  } else if (mode !== 'weekly') {
    decision = (
      <View className="gap-3">
        <Text className="text-sm text-text-secondary">{t('weeklyReview.switchWeeklyHint')}</Text>
        <Button
          label={t('weeklyReview.switchWeekly')}
          variant="gradientCta"
          width="full"
          disabled={busy}
          onPress={onSwitchWeekly}
        />
        <Button
          label={t('weeklyReview.keep')}
          variant="outline"
          width="full"
          disabled={busy}
          onPress={onKeep}
        />
      </View>
    );
  } else if (data.periodEnded) {
    // A past review can be acknowledged but never approved: its targets describe a week that is no
    // longer the one being lived, and approving would replace tomorrow's targets with them.
    decision = (
      <View className="gap-3">
        <Text className="text-sm text-text-secondary">{t('weeklyReview.endedHint')}</Text>
        <Button
          label={t('weeklyReview.keep')}
          variant="outline"
          width="full"
          disabled={busy}
          onPress={onKeep}
        />
      </View>
    );
  } else if (!recommendation?.canApply) {
    const { foodDay, weightDay } = data.gaps;
    decision = (
      <View className="gap-3">
        {/* Each button opens the reviewed week on a day still missing, never today: a closed
            week cannot gain evidence from anything logged after it. */}
        {weightDay != null || foodDay != null ? (
          <View className="flex-row flex-wrap gap-2">
            {weightDay != null ? (
              <Button
                label={t('weeklyReview.logWeightOn', { date: date(weightDay) })}
                icon={Scale}
                size="sm"
                variant="secondary"
                onPress={() => onLogWeight(weightDay)}
              />
            ) : null}
            {foodDay != null ? (
              <Button
                label={t('weeklyReview.logFoodOn', { date: date(foodDay) })}
                icon={UtensilsCrossed}
                size="sm"
                variant="secondary"
                onPress={() => onLogFood(foodDay)}
              />
            ) : null}
          </View>
        ) : null}
        <Button
          label={t('weeklyReview.keepCollecting')}
          variant="gradientCta"
          width="full"
          disabled={busy}
          onPress={onKeep}
        />
      </View>
    );
  } else {
    decision = (
      <View className="gap-3">
        <Button
          label={t('weeklyReview.applyTomorrow')}
          variant="gradientCta"
          width="full"
          disabled={busy}
          onPress={onApply}
        />
        <View className="flex-row gap-3">
          <Button
            label={t('weeklyReview.keepShort')}
            variant="outline"
            width="flex-1"
            disabled={busy}
            onPress={onKeep}
          />
          <Button
            label={t('weeklyReview.editShort')}
            icon={PencilLine}
            variant="outline"
            width="flex-1"
            disabled={busy}
            onPress={onEdit}
          />
        </View>
      </View>
    );
  }

  const shownRecommendation = decided && data.accepted ? data.accepted : recommendation?.targets;
  return (
    <View
      className="gap-4 rounded-2xl border border-border-light bg-bg-card p-4"
      testID="review-nutrition"
    >
      <ReviewSectionHeader title={t('weeklyReview.nutrition')} icon={Utensils} done={decided} />
      <Text className="text-xs font-semibold uppercase tracking-wider text-accent-primary">
        {t(MODE_KEYS[mode])}
      </Text>

      <StatStrip
        items={[
          {
            key: 'trend',
            value:
              data.trendWeight != null
                ? formatDisplayWeightKg(locale, units, data.trendWeight)
                : '–',
            unit: data.trendWeight != null ? t(getWeightUnitI18nKey(units)) : undefined,
            label: t('weeklyReview.stats.trendWeight'),
            valueColor: theme.colors.text.primary,
          },
          {
            key: 'food',
            value: `${formatInteger(recommendation?.foodDays ?? 0)}/7`,
            label: t('weeklyReview.stats.foodDays'),
            valueColor: theme.colors.text.primary,
          },
          {
            key: 'weight',
            value: `${formatInteger(recommendation?.weightDays ?? 0)}/7`,
            label: t('weeklyReview.stats.weighIns'),
            valueColor: theme.colors.text.primary,
          },
        ]}
        palette={{
          background: theme.colors.background.card,
          border: theme.colors.border.light,
          label: theme.colors.text.tertiary,
          unit: theme.colors.text.tertiary,
        }}
      />

      <View className="overflow-hidden rounded-xl border border-border-light">
        <View className="flex-row bg-bg-overlay px-3 py-2">
          <Text className="flex-1 text-xs font-bold uppercase text-text-tertiary">
            {t('weeklyReview.target')}
          </Text>
          <Text className="w-20 text-right text-xs font-bold uppercase text-text-tertiary">
            {t('weeklyReview.currentShort')}
          </Text>
          <Text
            className={`w-28 text-right text-xs font-bold uppercase ${estimate ? 'text-text-tertiary' : 'text-accent-primary'}`}
          >
            {t(recommendedColumnKey)}
          </Text>
        </View>
        {MACRO_FIELDS.map((field, index) => {
          const current = data.current![field];
          const next = shownRecommendation?.[field] ?? current;
          const delta = Math.round(next) - Math.round(current);
          return (
            <View
              key={field}
              className={`flex-row items-center px-3 py-2.5 ${index ? 'border-t border-border-light' : ''}`}
            >
              {/* The label already carries its unit: "Calories (kcal)". */}
              <Text className="flex-1 text-sm text-text-primary">{t(MACRO_LABEL_KEYS[field])}</Text>
              <Text className="w-20 text-right text-sm text-text-secondary">
                {formatInteger(Math.round(current))}
              </Text>
              <Text
                className={`w-28 text-right text-sm ${estimate ? 'text-text-tertiary' : 'font-bold text-text-primary'}`}
              >
                {formatInteger(Math.round(next))}
                {delta ? (
                  <Text
                    className={`text-xs font-semibold ${estimate ? 'text-text-tertiary' : 'text-accent-primary'}`}
                  >{` ${signed(delta)}`}</Text>
                ) : null}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="flex-row items-start gap-2">
        <Info size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
        <Text className="flex-1 text-sm text-text-secondary">{reason}</Text>
      </View>

      {belowFloor && recommendation?.minimumCalories != null ? (
        <View className="gap-1 rounded-xl bg-status-error/10 p-3" testID="review-below-floor">
          <Text className="text-sm font-semibold text-text-primary">
            {t('weeklyReview.belowFloorTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('weeklyReview.belowFloorBody', {
              minimum: formatInteger(recommendation.minimumCalories),
            })}
          </Text>
        </View>
      ) : null}

      {largeChange && recommendation ? (
        <View className="gap-1 rounded-xl bg-status-warning/10 p-3" testID="review-large-change">
          <Text className="text-sm font-semibold text-text-primary">
            {t('weeklyReview.largeChangeTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('weeklyReview.largeChangeBody', {
              percent: formatInteger(
                Math.round(
                  calorieChangeShare(
                    data.current.totalCalories,
                    recommendation.targets.totalCalories
                  ) * 100
                )
              ),
            })}
          </Text>
          <TextButton
            // The week under review, not today: that is the log this warning asks to check.
            onPress={() => onLogFood(data.period.start)}
            label={t('weeklyReview.reviewFoodLog')}
          />
        </View>
      ) : null}

      {decision}

      <TextButton label={t('weeklyReview.editGoal')} onPress={onEditGoal} align="center" />
    </View>
  );
}

/** The four targets shown when there is no week to compare them with. Fiber stays in the table. */
const COMPACT_TARGET_FIELDS = ['totalCalories', 'protein', 'carbs', 'fats'] as const;

/**
 * A nutrition half with no food in the reviewed week: there is nothing to compare, so the targets
 * shrink to one strip and the page asks for the missing evidence instead. A user who has never
 * logged a meal is sent to today's diary — the reviewed week is over, and their first review is
 * built from the week they are in. A week off is filled in on the reviewed week itself.
 */
function NutritionEmptyState({
  data,
  first,
  busy,
  decided,
  decidedBlock,
  logFoodLabel,
  onKeep,
  onEditGoal,
  onLogFood,
  onLogFirstMeal,
}: {
  data: Overview;
  first: boolean;
  busy: boolean;
  decided: boolean;
  decidedBlock: ReactNode;
  logFoodLabel: string;
  onKeep: () => void;
  onEditGoal: () => void;
  onLogFood: () => void;
  onLogFirstMeal: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const current = data.current!;
  const reviewable = hasWeeklyActivity(data.activity);
  let footer: ReactNode = null;
  if (decided) {
    footer = decidedBlock;
  } else if (reviewable) {
    // The training half has something in it, so the week waits on a nutrition answer to close.
    footer = (
      <Button
        label={t('weeklyReview.keep')}
        variant="outline"
        width="full"
        disabled={busy}
        onPress={onKeep}
      />
    );
  }

  return (
    <View
      className="gap-4 rounded-2xl border border-border-light bg-bg-card p-4"
      testID="review-nutrition"
    >
      <ReviewSectionHeader
        title={t('weeklyReview.nutrition')}
        icon={Utensils}
        done={reviewable ? decided : null}
      />
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wider text-accent-primary">
          {t('weeklyReview.empty.currentTargets')}
        </Text>
        <StatStrip
          items={COMPACT_TARGET_FIELDS.map((field) => ({
            key: field,
            value: formatInteger(Math.round(current[field])),
            label: t(MACRO_LABEL_KEYS[field]),
            valueColor: theme.colors.text.primary,
          }))}
          palette={{
            background: theme.colors.background.card,
            border: theme.colors.border.light,
            label: theme.colors.text.tertiary,
            unit: theme.colors.text.tertiary,
          }}
        />
      </View>
      <Text className="text-sm text-text-secondary">
        {t(first ? 'weeklyReview.empty.firstMeal' : 'weeklyReview.empty.noFoodThisWeek')}
      </Text>
      <Button
        label={first ? t('weeklyReview.empty.logFirstMeal') : logFoodLabel}
        icon={UtensilsCrossed}
        variant="gradientCta"
        width="full"
        onPress={first ? onLogFirstMeal : onLogFood}
      />
      {footer}
      <TextButton label={t('weeklyReview.editGoal')} onPress={onEditGoal} align="center" />
    </View>
  );
}
