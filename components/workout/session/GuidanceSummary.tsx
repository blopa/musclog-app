import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useAdjustmentMessage } from '@/components/workout/useAdjustmentMessage';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { ProgressionRule } from '@/utils/progressionRules';
import { isStartAdjustment, type SetAdjustment } from '@/utils/setAdjustment';

import { GUIDANCE_STATE_KEYS, type GuidanceState, PROGRESSION_METHOD_KEYS } from './sessionModel';

const BADGE_CLASSES: Record<GuidanceState, { surface: string; text: string }> = {
  rule: { surface: 'bg-accent-primary/10', text: 'text-accent-primary' },
  suggested: { surface: 'bg-accent-primary/10', text: 'text-accent-primary' },
  learning: { surface: 'bg-bg-overlay', text: 'text-text-secondary' },
  attention: { surface: 'bg-status-warning/10', text: 'text-status-warning' },
};

/** "Your rule · Double progression · 8–12" — the source of the targets, as one line. */
export function GuidanceBadgeLine({
  state,
  rule,
}: {
  state: GuidanceState;
  rule: ProgressionRule | null;
}) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const badge = BADGE_CLASSES[state];
  const range =
    rule && 'repMin' in rule
      ? `${formatInteger(rule.repMin, { useGrouping: false })}\u2060–\u2060${formatInteger(rule.repMax, { useGrouping: false })}`
      : null;
  return (
    <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
      <View className={`rounded-full px-2.5 py-1 ${badge.surface}`}>
        <Text className={`text-xs font-bold uppercase ${badge.text}`}>
          {t(GUIDANCE_STATE_KEYS[state])}
        </Text>
      </View>
      <Text className="shrink text-sm font-semibold text-text-primary">
        {t(PROGRESSION_METHOD_KEYS[rule?.type ?? 'automatic'])}
        {range ? <Text className="font-normal text-text-secondary">{` · ${range}`}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * The method behind an exercise's targets and the one sentence explaining them, with "Why?" and
 * "Use the plan's" beside the numbers they talk about. The whole header opens the explanation.
 */
export function GuidanceSummary({
  state,
  rule,
  adjustment,
  units,
  onWhy,
  onRevert,
  flat = false,
}: {
  state: GuidanceState;
  rule: ProgressionRule | null;
  adjustment?: SetAdjustment | null;
  units: Units;
  onWhy: () => void;
  onRevert?: () => void;
  /** Inside an exercise card already: no second box, so the card does not nest a card. */
  flat?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const message = useAdjustmentMessage(adjustment, units);
  // Without an adjustment to explain, say only what is true of the state: "log a workout to build
  // history" on an exercise that has history (a Suggested one whose set was just performed, which
  // clears its adjustment) contradicted the "Last time" printed right beside it.
  let hint = message;
  if (!hint && rule) {
    hint = t('progression.followRule');
  } else if (!hint && state === 'learning') {
    hint = t('progression.learningHint');
  }
  const canRevert = !!onRevert && !!adjustment && isStartAdjustment(adjustment);
  return (
    <View
      className={flat ? 'gap-1' : 'gap-2 rounded-xl border border-border-light bg-bg-secondary p-3'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(GUIDANCE_STATE_KEYS[state])}, ${t('trainingFlow.actions.guidance')}`}
        onPress={onWhy}
        className="min-h-11 flex-row items-center gap-2"
        testID="guidance-why"
      >
        <GuidanceBadgeLine state={state} rule={rule} />
        <View className="flex-row items-center">
          <Text className="text-sm font-semibold text-accent-primary">
            {t('trainingFlow.actions.guidance')}
          </Text>
          <ChevronRight size={theme.iconSize.sm} color={theme.colors.accent.primary} />
        </View>
      </Pressable>
      {hint ? (
        <Text className="text-sm leading-5 text-text-secondary" testID="set-adjustment-notice">
          {hint}
        </Text>
      ) : null}
      {canRevert ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRevert}
          className="min-h-11 justify-center self-start"
          testID="set-adjustment-revert"
        >
          <Text className="text-sm font-bold text-accent-primary">
            {t('workoutSession.adjustment.usePlan')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
