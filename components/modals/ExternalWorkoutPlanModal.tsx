import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, Copy, FileUp, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { PasteJsonSheet } from '@/components/aiOnboarding/PasteJsonSheet';
import { Button } from '@/components/theme/Button';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { useSnackbar } from '@/context/SnackbarContext';
import { getAllLocaleExerciseNamesBySlug, getExerciseCatalogue } from '@/data/exerciseCatalogue';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import type { IncomingOpenLink } from '@/hooks/useOpenLinkHandler';
import { useTheme } from '@/hooks/useTheme';
import { buildExternalChatUrl, type ExternalTarget } from '@/utils/aiOnboarding/instructions';
import { MAX_PLAN_BYTES, type PlanParseError } from '@/utils/aiWorkoutPlan/contract';
import { buildWorkoutPlanInstructions } from '@/utils/aiWorkoutPlan/instructions';
import { parseWorkoutPlanText } from '@/utils/aiWorkoutPlan/parse';
import { type ResolvedPlan, resolvePlanExercises } from '@/utils/aiWorkoutPlan/resolveExercises';
import { planToRawTemplate } from '@/utils/aiWorkoutPlan/toTemplate';
import { handleError } from '@/utils/handleError';
import { pickTextFile } from '@/utils/pickTextFile';

import { FullScreenModal } from './FullScreenModal';

/** What the person is told for each way an imported file can be unusable. */
const IMPORT_ERROR_KEYS: Record<PlanParseError, string> = {
  empty: 'workouts.externalPlan.errors.empty',
  tooLarge: 'workouts.externalPlan.errors.tooLarge',
  notJson: 'workouts.externalPlan.errors.notJson',
  notAnObject: 'workouts.externalPlan.errors.notJson',
  wrongSchema: 'workouts.externalPlan.errors.wrongSchema',
  invalidVersion: 'workouts.externalPlan.errors.wrongSchema',
  newerVersion: 'workouts.externalPlan.errors.newerVersion',
  invalidPlan: 'workouts.externalPlan.errors.invalidPlan',
  noExercises: 'workouts.externalPlan.errors.noExercises',
};

type ExternalWorkoutPlanModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once the plan exists, so the screen behind can refresh. */
  onCreated?: () => void;
  /**
   * The text of a tapped open link (`/open#workout=…`). Read once per `key`: success opens the
   * review directly, failure explains why on the first step.
   */
  incoming?: IncomingOpenLink | null;
};

type Review = { resolved: ResolvedPlan; skippedExercises: number };

/**
 * Builds a workout plan with ChatGPT or Claude outside the app: the instructions (rules, schema and
 * every exercise slug) are copied, the assistant interviews the person and writes a JSON file, and
 * the file comes back here by import or paste. Nothing is saved until the person has reviewed what
 * was understood, and only exercises that exist in the catalogue are ever created.
 */
export function ExternalWorkoutPlanModal({
  visible,
  onClose,
  onCreated,
  incoming = null,
}: ExternalWorkoutPlanModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [review, setReview] = useState<Review | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const handledLinkKey = useRef<number | null>(null);

  const catalogue = useMemo(() => (visible ? getExerciseCatalogue(locale) : []), [visible, locale]);
  const displayNames = useMemo(
    () => new Map(catalogue.map((entry) => [entry.exerciseSlug, entry.name])),
    [catalogue]
  );

  const instructions = () =>
    buildWorkoutPlanInstructions({
      language: locale,
      exerciseSlugs: catalogue.map((entry) => entry.exerciseSlug),
    });

  const copyInstructions = async (): Promise<boolean> => {
    try {
      await Clipboard.setStringAsync(instructions());
      return true;
    } catch (error) {
      handleError(error, 'ExternalWorkoutPlanModal.copy');
      return false;
    }
  };

  const open = async (target: ExternalTarget) => {
    setFallbackNotice(false);
    const copied = await copyInstructions();
    if (copied) {
      showSnackbar('success', t('workouts.externalPlan.copiedPaste'), { duration: 4000 });
    }

    try {
      // The prompt carries the whole exercise list, so a prefilled link is rarely short enough;
      // the clipboard copy above is what always works.
      await Linking.openURL(buildExternalChatUrl(target, instructions()).url);
    } catch {
      setFallbackNotice(true);
    }
  };

  const copyOnly = async () => {
    setFallbackNotice(false);
    if (await copyInstructions()) {
      showSnackbar('success', t('workouts.externalPlan.copied'));
    } else {
      setFallbackNotice(true);
    }
  };

  /** Validates imported text; on success the review opens. Returns the problem to show, if any. */
  const accept = (text: string): string | null => {
    const result = parseWorkoutPlanText(text);
    if (!result.ok) {
      return t(IMPORT_ERROR_KEYS[result.error]);
    }

    const resolved = resolvePlanExercises(
      result.plan,
      Array.from(getAllLocaleExerciseNamesBySlug(), ([exerciseSlug, names]) => ({
        exerciseSlug,
        names,
      }))
    );
    if (resolved.workouts.length === 0) {
      return t(IMPORT_ERROR_KEYS.noExercises);
    }

    setReview({ resolved, skippedExercises: result.skippedExercises });
    return null;
  };

  // The newest link wins, replacing a review that is already open. Declared after `accept`, run
  // through a named helper so the state updates are not set directly in the effect body.
  const acceptIncoming = (link: IncomingOpenLink) => {
    const problem = accept(link.text);
    setLinkError(problem ? t('workouts.externalPlan.linkError', { reason: problem }) : null);
  };

  useEffect(() => {
    if (!visible || !incoming || handledLinkKey.current === incoming.key) {
      return;
    }

    handledLinkKey.current = incoming.key;
    acceptIncoming(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the link, not on the handlers
  }, [visible, incoming]);

  const importFile = async () => {
    setFileError(null);
    setLinkError(null);
    try {
      const picked = await pickTextFile({ maxBytes: MAX_PLAN_BYTES });
      if (picked.status === 'cancelled') {
        return;
      }

      setFileError(
        picked.status === 'tooLarge' ? t(IMPORT_ERROR_KEYS.tooLarge) : accept(picked.text)
      );
    } catch (error) {
      handleError(error, 'ExternalWorkoutPlanModal.importFile');
      setFileError(t('workouts.externalPlan.errors.fileRead'));
    }
  };

  const submitPasted = (text: string) => {
    const error = accept(text);
    setPasteError(error);
    if (!error) {
      setPasteOpen(false);
    }
  };

  const create = async () => {
    if (!review || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const { template, options } = planToRawTemplate(
        review.resolved.plan,
        review.resolved.workouts
      );
      const created = await WorkoutTemplateService.createWorkoutsFromJsonTemplate(
        template,
        options
      );
      if (!created.plan) {
        showSnackbar('error', t('common.error'));
        return;
      }

      showSnackbar(
        'success',
        t('workouts.createFromTemplate.successMessageWithPlan', {
          planName: created.plan.name,
          count: created.templates.length,
        })
      );
      setReview(null);
      onCreated?.();
      onClose();
    } catch (error) {
      handleError(error, 'ExternalWorkoutPlanModal.create');
      showSnackbar('error', t('common.error'));
    } finally {
      setIsCreating(false);
    }
  };

  const weekdayLabels = (days: number[]) => {
    // 2024-01-01 is a Monday, so day index N is the Nth day after it.
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return days.map((day) => formatter.format(new Date(2024, 0, 1 + day))).join(', ');
  };

  const textStyle = (color: string, size: number) => ({ color, fontSize: size });

  const close = () => {
    setReview(null);
    setFileError(null);
    setLinkError(null);
    setFallbackNotice(false);
    onClose();
  };

  const steps = [
    'workouts.externalPlan.steps.one',
    'workouts.externalPlan.steps.two',
    'workouts.externalPlan.steps.three',
  ] as const;

  const renderReview = (current: Review) => {
    const { resolved, skippedExercises } = current;
    const { plan, workouts, unmatched } = resolved;
    const unmatchedNames = Array.from(new Set(unmatched.map((item) => item.requested))).join(', ');

    return (
      <View className="gap-6 px-4 pt-4">
        <Text style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.base)}>
          {t('workouts.externalPlan.review.intro')}
        </Text>

        <View className="gap-1">
          <Text
            style={{
              ...textStyle(theme.colors.text.primary, theme.typography.fontSize.xl),
              fontWeight: theme.typography.fontWeight.bold,
            }}
          >
            {plan.title}
          </Text>
          {plan.description ? (
            <Text style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.sm)}>
              {plan.description}
            </Text>
          ) : null}
          <Text style={textStyle(theme.colors.text.tertiary, theme.typography.fontSize.sm)}>
            {plan.weekDays.length > 0
              ? t('workouts.externalPlan.review.weeklyOn', { days: weekdayLabels(plan.weekDays) })
              : t('workouts.externalPlan.review.rotating')}
          </Text>
        </View>

        {workouts.map((workout, index) => (
          <View key={`${workout.name ?? 'day'}-${index}`} className="gap-2">
            <SectionLabel>
              {workout.name ?? t('workouts.plans.defaultDayName', { day: index + 1 })}
            </SectionLabel>
            {workout.exercises.map((exercise) => (
              <View
                key={exercise.exerciseSlug}
                className="flex-row flex-wrap items-baseline justify-between gap-x-3"
              >
                <Text
                  className="min-w-0 grow basis-[160px]"
                  style={textStyle(theme.colors.text.primary, theme.typography.fontSize.base)}
                >
                  {displayNames.get(exercise.exerciseSlug) ?? exercise.exerciseSlug}
                </Text>
                <Text
                  className="shrink-0 tabular-nums"
                  style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.sm)}
                >
                  {exercise.minReps === undefined
                    ? t('workouts.externalPlan.review.setsReps', {
                        sets: formatInteger(exercise.sets),
                        reps: formatInteger(exercise.reps),
                      })
                    : t('workouts.externalPlan.review.setsRepsRange', {
                        sets: formatInteger(exercise.sets),
                        min: formatInteger(exercise.minReps),
                        max: formatInteger(exercise.reps),
                      })}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {unmatched.length > 0 ? (
          <Text style={textStyle(theme.colors.status.warning, theme.typography.fontSize.sm)}>
            {t('workouts.externalPlan.review.unmatched', {
              count: unmatched.length,
              names: unmatchedNames,
            })}
          </Text>
        ) : null}
        {skippedExercises > 0 ? (
          <Text style={textStyle(theme.colors.status.warning, theme.typography.fontSize.sm)}>
            {t('workouts.externalPlan.review.skipped', { count: skippedExercises })}
          </Text>
        ) : null}

        <View className="gap-3">
          <Button
            label={t('workouts.externalPlan.review.create')}
            variant="accent"
            width="full"
            loading={isCreating}
            onPress={create}
          />
          <Button
            label={t('workouts.externalPlan.review.differentFile')}
            variant="outline"
            width="full"
            disabled={isCreating}
            onPress={() => setReview(null)}
          />
        </View>
      </View>
    );
  };

  return (
    <FullScreenModal visible={visible} onClose={close} title={t('workouts.externalPlan.title')}>
      {review ? (
        renderReview(review)
      ) : (
        <View className="gap-6 px-4 pb-12 pt-4">
          <View className="gap-2">
            <Text style={textStyle(theme.colors.text.secondary, theme.typography.fontSize.base)}>
              {t('workouts.externalPlan.intro')}
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
            <SectionLabel>{t('workouts.externalPlan.leaveSection')}</SectionLabel>
            <Button
              label={t('workouts.externalPlan.openChatgpt')}
              variant="accent"
              width="full"
              onPress={() => open('chatgpt')}
            />
            <Button
              label={t('workouts.externalPlan.openClaude')}
              variant="accent"
              width="full"
              onPress={() => open('claude')}
            />
            <View className="flex-row flex-wrap gap-3">
              <Button
                label={t('workouts.externalPlan.copy')}
                icon={Copy}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={copyOnly}
              />
              <Button
                label={t('workouts.externalPlan.share')}
                icon={Share2}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() =>
                  shareText(instructions()).catch((error) =>
                    handleError(error, 'ExternalWorkoutPlanModal.share')
                  )
                }
              />
            </View>
            {fallbackNotice ? (
              <Text style={textStyle(theme.colors.status.error, theme.typography.fontSize.sm)}>
                {t('workouts.externalPlan.fallback')}
              </Text>
            ) : null}
            <Text style={textStyle(theme.colors.text.tertiary, theme.typography.fontSize.sm)}>
              {t('workouts.externalPlan.privacy')}
            </Text>
          </View>

          <View className="gap-3">
            <SectionLabel>{t('workouts.externalPlan.backSection')}</SectionLabel>
            <Button
              label={t('workouts.externalPlan.importFile')}
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
              label={t('workouts.externalPlan.pasteJson')}
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
              {t('workouts.externalPlan.noFile')}
            </Text>
          </View>
        </View>
      )}

      <PasteJsonSheet
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onSubmit={submitPasted}
        error={pasteError}
        title={t('workouts.externalPlan.paste.title')}
        subtitle={t('workouts.externalPlan.paste.subtitle')}
        placeholder={t('workouts.externalPlan.paste.placeholder')}
      />
    </FullScreenModal>
  );
}
