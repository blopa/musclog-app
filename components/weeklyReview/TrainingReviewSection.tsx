import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  Play,
  Trophy,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { StatStrip } from '@/components/StatStrip';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { WorkoutRecommendationList } from '@/components/workout/WorkoutRecommendationList';
import type { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import { summarizeWeeklyRecords } from '@/utils/weeklyRecords';
import { hasWeeklyActivity, trainingHalfState } from '@/utils/weeklyReviewEmptyState';

type Overview = Awaited<ReturnType<typeof WeeklyReviewService.overview>>;

/** Records shown before "Show all": enough to celebrate, few enough to reach the next section. */
const VISIBLE_RECORDS = 3;

const PR_TYPE_KEYS = {
  weight: 'weeklyReview.prTypes.weight',
  reps: 'weeklyReview.prTypes.reps',
  volume: 'weeklyReview.prTypes.volume',
} as const;

/**
 * A review section's header: its title and whether it is done, in words as well as colour. `null`
 * hides the badge — a week with nothing in it has nothing "to review".
 */
export function ReviewSectionHeader({
  title,
  icon: Icon,
  done,
}: {
  title: string;
  icon: typeof Dumbbell;
  done: boolean | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10">
        <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
      </View>
      <Text className="flex-1 text-xl font-bold text-text-primary">{title}</Text>
      {done == null ? null : (
        <View
          className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${done ? 'bg-accent-primary' : 'bg-bg-overlay'}`}
        >
          {done ? (
            <CheckCircle2 size={theme.iconSize.xs} color={theme.colors.text.onAccent} />
          ) : null}
          <Text
            className={`text-xs font-bold ${done ? 'text-text-on-accent' : 'text-text-secondary'}`}
          >
            {t(done ? 'weeklyReview.reviewed' : 'weeklyReview.toReview')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The Training half of a Weekly Review: what was done, what improved, and what comes next. Marking
 * it reviewed is an acknowledgement only — workout targets never wait for it.
 *
 * A week without workouts drops the summary of zeros for an empty state; a user who has never
 * logged one is pointed at their first. The acknowledgement is offered only when the week holds
 * something to review at all — otherwise there is nothing to acknowledge.
 */
export function TrainingReviewSection({
  data,
  busy,
  onAcknowledge,
  onPreviewNext,
  onEditPlan,
  onLogWorkout,
}: {
  data: Overview;
  busy: boolean;
  onAcknowledge: () => void;
  onPreviewNext: () => void;
  onEditPlan: () => void;
  /** Opens Workouts, where a first workout is started. */
  onLogWorkout: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { formatInteger } = useFormatAppNumber();
  const [showTargets, setShowTargets] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { training } = data;
  const recordRows = summarizeWeeklyRecords(training.records);
  const reviewed = !!training.reviewedAt;
  const state = trainingHalfState(data.activity);
  const reviewable = hasWeeklyActivity(data.activity);
  const weightUnit = t(getWeightUnitI18nKey(units));
  const weekday = (value: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
      value
    );

  return (
    <View
      className="gap-4 rounded-2xl border border-border-light bg-bg-card p-4"
      testID="review-training"
    >
      <ReviewSectionHeader
        title={t('weeklyReview.training')}
        icon={Dumbbell}
        done={reviewable ? reviewed : null}
      />

      {state === 'data' ? (
        <StatStrip
          items={[
            {
              key: 'workouts',
              value: formatInteger(training.workouts.length),
              label: t('weeklyReview.stats.workouts'),
              valueColor: theme.colors.text.primary,
            },
            {
              key: 'sets',
              value: formatInteger(training.workingSets),
              label: t('weeklyReview.stats.workingSets'),
              valueColor: theme.colors.text.primary,
            },
            {
              key: 'volume',
              value: formatInteger(Math.round(kgToDisplay(training.volume, units))),
              unit: weightUnit,
              label: t('weeklyReview.stats.volume'),
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
      ) : null}

      {training.workouts.length ? (
        <View className="gap-1.5">
          {training.workouts.map((workout) => (
            <View key={workout.id} className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm text-text-primary" numberOfLines={1}>
                {workout.workoutName}
              </Text>
              <Text className="text-xs text-text-secondary">
                {workout.completedAt ? weekday(workout.completedAt) : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-text-secondary">
          {t(
            state === 'first'
              ? 'weeklyReview.empty.firstWorkout'
              : 'weeklyReview.noWorkoutsThisWeek'
          )}
        </Text>
      )}

      {state === 'first' ? (
        <Button
          label={t('weeklyReview.empty.logFirstWorkout')}
          icon={Dumbbell}
          variant="gradientCta"
          width="full"
          onPress={onLogWorkout}
        />
      ) : null}

      {recordRows.length ? (
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {t('weeklyReview.records')}
          </Text>
          {(showAllRecords ? recordRows : recordRows.slice(0, VISIBLE_RECORDS)).map((record) => (
            <View
              key={record.exerciseId}
              className="flex-row items-center gap-3 rounded-xl bg-bg-overlay px-3 py-2.5"
            >
              <Trophy size={theme.iconSize.md} color={theme.colors.accent.primary} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                  {record.exerciseName}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {record.types.map((type) => t(PR_TYPE_KEYS[type])).join(' · ')}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-text-primary">
                {`${formatDisplayWeightKg(locale, units, record.best.weight)} ${weightUnit} × ${formatInteger(record.best.reps)}`}
              </Text>
            </View>
          ))}
          {recordRows.length > VISIBLE_RECORDS ? (
            <TextButton
              accessibilityState={{ expanded: showAllRecords }}
              onPress={() => setShowAllRecords(!showAllRecords)}
              label={
                showAllRecords
                  ? t('weeklyReview.showFewer')
                  : t('weeklyReview.showAll', { count: formatInteger(recordRows.length) })
              }
            />
          ) : null}
        </View>
      ) : null}

      {training.next ? (
        <View className="gap-3 rounded-xl border border-border-light p-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {t('weeklyReview.nextUp')}
          </Text>
          <Text className="text-base font-bold text-text-primary">
            {training.next.template.name}
          </Text>
          <View className="gap-2">
            <Button
              label={t('weeklyReview.previewNext')}
              icon={Play}
              size="sm"
              width="full"
              variant="secondary"
              onPress={onPreviewNext}
            />
            <Button
              label={t('progression.editPlan')}
              icon={ClipboardList}
              size="sm"
              width="full"
              variant="outline"
              onPress={onEditPlan}
            />
          </View>
          {training.targets.length ? (
            <>
              <TextButton
                accessibilityState={{ expanded: showTargets }}
                onPress={() => setShowTargets(!showTargets)}
                icon={showTargets ? ChevronUp : ChevronDown}
                iconPosition="right"
                label={t('weeklyReview.upcomingTargets', { count: training.targets.length })}
              />
              {showTargets ? (
                <WorkoutRecommendationList recommendations={training.targets} />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {/* A first-timer already has the "Log your first workout" button above. */}
      {!training.next && state !== 'first' ? (
        <Text className="text-sm text-text-secondary">{t('weeklyReview.noWorkout')}</Text>
      ) : null}

      {reviewable ? (
        <Text className="text-xs text-text-tertiary">{t('weeklyReview.trainingHint')}</Text>
      ) : null}
      {reviewed || !reviewable ? null : (
        <Button
          label={t('weeklyReview.acknowledge')}
          icon={CheckCircle2}
          // An empty half is still acknowledged so the week can be closed, but it is not the
          // page's main action.
          variant={state === 'data' ? 'gradientCta' : 'outline'}
          width="full"
          onPress={onAcknowledge}
          disabled={busy}
        />
      )}
    </View>
  );
}
