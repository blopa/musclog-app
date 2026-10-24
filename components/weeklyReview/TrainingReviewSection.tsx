import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  Play,
  Target,
  Trophy,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { StatStrip } from '@/components/StatStrip';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { TextButton } from '@/components/theme/TextButton';
import { WorkoutRecommendationList } from '@/components/workout/WorkoutRecommendationList';
import type { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import {
  type GoalVerdict,
  TRAINING_DECISIONS,
  type TrainingDecision,
} from '@/utils/trainingWeekDecision';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import { summarizeWeeklyRecords } from '@/utils/weeklyRecords';
import { hasWeeklyActivity, trainingHalfState } from '@/utils/weeklyReviewEmptyState';

import {
  CONSISTENCY_STATUS_KEYS,
  DECISION_COPY,
  isGoodStatus,
  ONE_RM_STATUS_KEYS,
  REASON_KEYS,
} from './trainingDecisionCopy';

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
 * The Training half of a Weekly Review: what was done, how it measured up against the user's
 * fitness goals, and a decision for next week (keep progressing, repeat, or a lighter week) that
 * changes how the next workouts start — the training counterpart of the nutrition decision.
 *
 * A week without workouts drops the summary of zeros for an empty state; a user who has never
 * logged one is pointed at their first and is not asked to decide anything.
 */
export function TrainingReviewSection({
  data,
  busy,
  onDecide,
  onChangeConsistencyGoal,
  onOpenGoals,
  onPreviewNext,
  onEditPlan,
  onLogWorkout,
}: {
  data: Overview;
  busy: boolean;
  onDecide: (decision: TrainingDecision) => void;
  /** Applies a suggested workouts-per-week target; only ever called from a tap. */
  onChangeConsistencyGoal: (sessionsPerWeek: number) => void;
  /** Opens the fitness goals editor. */
  onOpenGoals: () => void;
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
  const [picked, setPicked] = useState<TrainingDecision | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { training } = data;
  const recordRows = summarizeWeeklyRecords(training.records);
  // Someone who has never finished a workout is not asked to decide, so there is nothing pending.
  const reviewed = !!training.reviewedAt || !data.activity.everWorkout;
  const decided = training.decision;
  const choice = picked ?? training.proposal.recommended;
  // A decided week shows the evidence it was decided on; an open one shows today's.
  const verdicts = decided?.goals ?? training.proposal.goals;
  const reasons = decided?.reasons ?? training.proposal.reasons;
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
          <Text className="text-xs font-bold text-text-secondary">{t('weeklyReview.records')}</Text>
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
          <Text className="text-xs font-bold text-text-secondary">{t('weeklyReview.nextUp')}</Text>
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
        <View className="gap-2" testID="review-training-goals">
          <Text className="text-xs font-bold text-text-secondary">
            {t('weeklyReview.goals.title')}
          </Text>
          {verdicts.length ? (
            verdicts.map((verdict) => (
              <GoalVerdictRow
                key={verdict.goalId}
                verdict={verdict}
                locale={locale}
                formatInteger={formatInteger}
              />
            ))
          ) : (
            <Text className="text-sm text-text-secondary">{t('weeklyReview.goals.none')}</Text>
          )}
          {training.consistencySuggestion && training.canDecide ? (
            <TextButton
              icon={Target}
              disabled={busy}
              onPress={() => onChangeConsistencyGoal(training.consistencySuggestion!.to)}
              label={t(
                training.consistencySuggestion.kind === 'lower'
                  ? 'weeklyReview.goals.lowerTo'
                  : 'weeklyReview.goals.raiseTo',
                { count: training.consistencySuggestion.to }
              )}
            />
          ) : null}
          {verdicts.length ? null : (
            <TextButton
              icon={Target}
              onPress={onOpenGoals}
              label={t('weeklyReview.goals.setGoal')}
            />
          )}
        </View>
      ) : null}

      {decided ? (
        <View className="gap-1 rounded-xl bg-bg-overlay p-3" testID="review-training-decided">
          <Text className="text-xs font-bold text-text-secondary">
            {t('weeklyReview.trainingDecision.title')}
          </Text>
          <Text className="text-base font-bold text-text-primary">
            {t(DECISION_COPY[decided.decision].chosen)}
          </Text>
          {decided.decision === 'progress' ? null : (
            <Text className="text-sm text-text-secondary">
              {t('weeklyReview.trainingDecision.until', { date: weekday(decided.window.until) })}
            </Text>
          )}
        </View>
      ) : null}

      {training.canDecide && !decided ? (
        <View className="gap-3" testID="review-training-decision">
          <Text className="text-xs font-bold text-text-secondary">
            {t('weeklyReview.trainingDecision.title')}
          </Text>
          <Text className="text-xs text-text-tertiary">{t('weeklyReview.trainingHint')}</Text>
          <View className="gap-2">
            {TRAINING_DECISIONS.map((option) => (
              <ListRow
                key={option}
                title={t(DECISION_COPY[option].title)}
                overline={
                  option === training.proposal.recommended
                    ? t('weeklyReview.trainingDecision.recommended')
                    : undefined
                }
                subtitle={t(DECISION_COPY[option].description)}
                selected={option === choice}
                disabled={busy}
                onPress={() => setPicked(option)}
              />
            ))}
          </View>
          {reasons.map((reason) => (
            <Text key={reason.code} className="text-sm text-text-secondary">
              {t(REASON_KEYS[reason.code], { count: reason.count })}
            </Text>
          ))}
          <Button
            label={t(DECISION_COPY[choice].confirm)}
            icon={CheckCircle2}
            variant={state === 'data' ? 'gradientCta' : 'outline'}
            width="full"
            onPress={() => onDecide(choice)}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
}

/** One fitness goal and how the reviewed week measured up against it. */
function GoalVerdictRow({
  verdict,
  locale,
  formatInteger,
}: {
  verdict: GoalVerdict;
  locale: string;
  formatInteger: (value: number) => string;
}) {
  const { t } = useTranslation();
  const good = isGoodStatus(verdict.status);
  const label = t(
    verdict.kind === 'consistency'
      ? CONSISTENCY_STATUS_KEYS[verdict.status]
      : ONE_RM_STATUS_KEYS[verdict.status]
  );
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-bg-overlay px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
          {verdict.kind === 'consistency'
            ? t('weeklyReview.goals.consistency', {
                done: formatInteger(verdict.done),
                target: formatInteger(verdict.target),
              })
            : verdict.exerciseName}
        </Text>
        {verdict.kind === '1rm' && verdict.projectedDate != null ? (
          <Text className="text-xs text-text-secondary">
            {t('weeklyReview.goals.projected', {
              date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
                verdict.projectedDate
              ),
            })}
          </Text>
        ) : null}
      </View>
      <View
        className={`rounded-full px-2.5 py-1 ${good ? 'bg-status-success/15' : 'bg-status-warning/15'}`}
      >
        <Text
          className={`text-xs font-bold ${good ? 'text-status-success' : 'text-status-warning'}`}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
