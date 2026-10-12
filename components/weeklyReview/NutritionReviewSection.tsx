import {
  CalendarCheck,
  Info,
  PencilLine,
  Scale,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { StatStrip } from '@/components/StatStrip';
import { Button } from '@/components/theme/Button';
import { nutritionTargetMode } from '@/database/services/NutritionTargetService';
import type { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

import { isLargeCalorieChange, nutritionReason } from './nutritionReason';
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

const DAY_MS = 24 * 60 * 60 * 1000;

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
}: {
  data: Overview;
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
  onEdit: () => void;
  onSwitchWeekly: () => void;
  onEditGoal: () => void;
  onLogWeight: () => void;
  onLogFood: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
        <ReviewSectionHeader title={t('weeklyReview.nutrition')} icon={Utensils} done={false} />
        <Text className="text-sm text-text-secondary">{t('weeklyReview.noGoal')}</Text>
      </View>
    );
  }

  const mode = nutritionTargetMode(data.goal);
  const recommendation = data.nutrition;
  const decided = !!data.review?.nutritionReviewedAt;
  const signed = (value: number) =>
    new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(
      value
    );
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
      change: `${new Intl.NumberFormat(locale, {
        signDisplay: 'exceptZero',
        maximumFractionDigits: 1,
      }).format(kgToDisplay(why.trendChangeKg, units))} ${weightUnit}`,
    });
  } else if ('expenditure' in why) {
    reason = t(why.key, { expenditure: formatInteger(why.expenditure) });
  } else {
    reason = t(why.key);
  }
  const largeChange =
    !decided &&
    !!recommendation?.canApply &&
    isLargeCalorieChange(data.current.totalCalories, recommendation.targets.totalCalories);

  let decision;
  if (decided) {
    const applied = data.review?.nutritionDecision === 'apply';
    decision = (
      <View className="bg-accent-primary10 flex-row items-start gap-3 rounded-xl p-3">
        <CalendarCheck size={theme.iconSize.md} color={theme.colors.accent.primary} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-bold text-text-primary">
            {t(applied ? 'weeklyReview.applied' : 'weeklyReview.kept')}
          </Text>
          {applied && data.review?.nutritionReviewedAt ? (
            <Text className="text-sm text-text-secondary">
              {t('weeklyReview.effective', {
                date: date(data.review.nutritionReviewedAt + DAY_MS),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    );
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
  } else if (!recommendation?.canApply) {
    decision = (
      <View className="gap-3">
        <View className="flex-row flex-wrap gap-2">
          <Button
            label={t('weeklyReview.logWeight')}
            icon={Scale}
            size="sm"
            variant="secondary"
            onPress={onLogWeight}
          />
          <Button
            label={t('weeklyReview.logFood')}
            icon={UtensilsCrossed}
            size="sm"
            variant="secondary"
            onPress={onLogFood}
          />
        </View>
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
          <Text className="w-28 text-right text-xs font-bold uppercase text-accent-primary">
            {t(decided ? 'weeklyReview.savedShort' : 'weeklyReview.recommended')}
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
              <Text className="flex-1 text-sm text-text-primary">{t(MACRO_LABEL_KEYS[field])}</Text>
              <Text className="w-20 text-right text-sm text-text-secondary">
                {formatInteger(Math.round(current))}
              </Text>
              <Text className="w-28 text-right text-sm font-bold text-text-primary">
                {formatInteger(Math.round(next))}
                {delta ? (
                  <Text className="text-xs font-semibold text-accent-primary">{` ${signed(delta)}`}</Text>
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

      {largeChange ? (
        <View className="gap-1 rounded-xl bg-status-warning10 p-3" testID="review-large-change">
          <Text className="text-sm font-semibold text-text-primary">
            {t('weeklyReview.largeChangeTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">{t('weeklyReview.largeChangeBody')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onLogFood}
            className="min-h-11 justify-center self-start"
          >
            <Text className="text-sm font-bold text-accent-primary">
              {t('weeklyReview.reviewFoodLog')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {decision}

      <Pressable
        accessibilityRole="button"
        onPress={onEditGoal}
        className="min-h-11 items-center justify-center"
      >
        <Text className="text-sm font-semibold text-accent-primary">
          {t('weeklyReview.editGoal')}
        </Text>
      </Pressable>
    </View>
  );
}
