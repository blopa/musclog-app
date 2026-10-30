import { useLocalSearchParams, useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import {
  type AnswerFormatters,
  FIELD_LABEL_KEYS,
  formatAnswer,
  OPTIONAL_FIELDS,
  REVIEW_SECTIONS,
} from '@/components/aiOnboarding/fieldChoices';
import { ReviewFieldRow } from '@/components/aiOnboarding/ReviewFieldRow';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { ListGroup } from '@/components/theme/ListGroup';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextButton } from '@/components/theme/TextButton';
import { COMEBACK_ROUTE } from '@/constants/comebackRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import { useAiGuidedExit } from '@/hooks/useAiGuidedExit';
import { type AiOnboardingDraftApi, useAiOnboardingDraft } from '@/hooks/useAiOnboardingDraft';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  applyOnboardingAnswers,
  applyProfileUpdate,
  loadProfileSnapshot,
  type ProfileApplyNote,
} from '@/services/onboardingAnswersApply';
import {
  type AnswerWarning,
  crossFieldWarnings,
  type FieldKey,
  hasRequiredAnswers,
  missingRequiredFields,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import type { AiOnboardingMode } from '@/utils/aiOnboarding/draftStorage';
import { buildProfileDiff, type ProfileSnapshot } from '@/utils/aiOnboarding/merge';
import { formatLocalCalendarDayNumericIntl, parseLocalCalendarDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { aiSetupRoute, PROFILE_ROUTE, resolveAiSetupMode } from '@/utils/onboardingRoutes';

const WARNING_KEYS: Record<AnswerWarning['code'], string> = {
  weightGoalConflictsFocus: 'aiOnboarding.review.warnings.weightGoalConflictsFocus',
  dobAgeMismatch: 'aiOnboarding.review.warnings.dobAgeMismatch',
  comebackStartsAtMaintenance: 'aiOnboarding.review.warnings.comebackStartsAtMaintenance',
  unusualBodyMeasurements: 'aiOnboarding.review.warnings.unusualBodyMeasurements',
};

const NOTE_KEYS: Record<ProfileApplyNote, string> = {
  gymKept: 'aiOnboarding.review.notes.gymKept',
  daysNotApplied: 'aiOnboarding.review.notes.daysNotApplied',
  comebackNotStarted: 'aiOnboarding.review.notes.comebackNotStarted',
  recalculationSkipped: 'aiOnboarding.review.notes.recalculationSkipped',
};

/**
 * The review: every answer in one place, editable in place, and nothing saved until the person
 * applies it. The same screen serves a conversation, an imported file and a profile update; for a
 * profile it shows each answer next to what is saved now, with a choice to keep or skip each change.
 */
export default function AiReviewScreen() {
  const theme = useTheme();
  const mode = resolveAiSetupMode(useLocalSearchParams<{ mode?: string }>().mode);
  const draftApi = useAiOnboardingDraft(mode);

  if (draftApi.loading || !draftApi.draft) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  return <ReviewBody mode={mode} draftApi={draftApi} />;
}

function ReviewBody({
  mode,
  draftApi,
}: {
  mode: AiOnboardingMode;
  draftApi: AiOnboardingDraftApi;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { units: settingsUnits, useBfForCalculations } = useSettings();
  const { formatDecimal } = useFormatAppNumber();
  const draft = draftApi.draft!;
  const isProfile = mode === 'profile';
  const answers = draft.answers;
  const units = answers.units ?? settingsUnits;
  const goGuided = useAiGuidedExit(mode, draftApi);

  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<FieldKey>>(new Set());
  const [recalculate, setRecalculate] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);

  useEffect(() => {
    if (!isProfile) {
      return;
    }

    let cancelled = false;
    loadProfileSnapshot()
      .then((loaded) => {
        if (!cancelled) {
          setSnapshot(loaded);
        }
      })
      .catch((error) => handleError(error, 'AiReviewScreen.snapshot'));

    return () => {
      cancelled = true;
    };
  }, [isProfile]);

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formatters: AnswerFormatters = useMemo(
    () => ({
      t: (key: string) => t(key),
      units,
      formatDecimal: (value, digits = 1) => formatDecimal(value, digits),
      formatDate: (iso) => formatLocalCalendarDayNumericIntl(parseLocalCalendarDate(iso), locale),
    }),
    [t, units, formatDecimal, locale]
  );

  const diff = useMemo(
    () => (snapshot ? buildProfileDiff(snapshot, answers, new Date()) : []),
    [snapshot, answers]
  );
  const diffByField = useMemo(() => new Map(diff.map((row) => [row.field, row])), [diff]);
  const kept = useMemo(
    () =>
      new Set<FieldKey>(
        diff.filter((row) => row.keepByDefault && !skipped.has(row.field)).map((row) => row.field)
      ),
    [diff, skipped]
  );

  const missing = useMemo(
    () => (isProfile ? [] : missingRequiredFields(answers)),
    [isProfile, answers]
  );
  const rejected = useMemo(
    () =>
      (draft.importNotes?.issues ?? [])
        .map((issue) => issue.field)
        .filter((field) => answers[field] === undefined && !OPTIONAL_FIELDS.has(field)),
    [draft.importNotes, answers]
  );
  const needsAttention = useMemo(
    () => new Set<FieldKey>([...missing, ...rejected]),
    [missing, rejected]
  );
  const warnings = useMemo(() => crossFieldWarnings(answers), [answers]);
  const ignoredKeys = draft.importNotes?.ignoredKeys ?? [];

  const change = useCallback(
    (next: OnboardingAnswersDraft) => {
      setApplyFailed(false);
      void draftApi.update({ answers: next });
    },
    [draftApi]
  );

  const canApply = isProfile
    ? snapshot !== null && kept.size > 0
    : missing.length === 0 && hasRequiredAnswers(answers);

  const apply = async () => {
    if (applying || !canApply) {
      return;
    }

    setApplying(true);
    setApplyFailed(false);
    try {
      if (isProfile) {
        const result = await applyProfileUpdate(answers, {
          draftId: draft.draftId,
          kept,
          recalculateNutrition: recalculate,
          useBodyFat: useBfForCalculations,
        });
        draftApi.discard();
        if (result.notes.length > 0) {
          showSnackbar('success', result.notes.map((note) => t(NOTE_KEYS[note])).join(' '), {
            duration: 6000,
          });
        }

        router.replace((result.nextRoute ?? PROFILE_ROUTE) as never);
      } else if (hasRequiredAnswers(answers)) {
        const result = await applyOnboardingAnswers(answers, {
          draftId: draft.draftId,
          skipMusclogApi: draft.skipMusclogApi,
          useBodyFat: useBfForCalculations,
        });
        draftApi.discard();
        router.replace(result.nextRoute as never);
      }
    } catch (error) {
      handleError(error, 'AiReviewScreen.apply');
      setApplyFailed(true);
    } finally {
      setApplying(false);
    }
  };

  const toggleKept = (field: FieldKey) =>
    setSkipped((previous) => {
      const next = new Set(previous);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }

      return next;
    });

  const visibleFields = (fields: readonly FieldKey[]) =>
    isProfile ? fields.filter((field) => diffByField.has(field)) : fields;

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader title={t('aiOnboarding.review.title')} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5 px-4 pt-4">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.base }}
          >
            {t(isProfile ? 'aiOnboarding.review.profileIntro' : 'aiOnboarding.review.intro')}
          </Text>

          {isProfile && snapshot === null ? (
            <ActivityIndicator color={theme.colors.accent.primary} />
          ) : null}

          {REVIEW_SECTIONS.map((section) => {
            const fields = visibleFields(section.fields);
            if (fields.length === 0) {
              return null;
            }

            return (
              <ListGroup key={section.titleKey} title={t(section.titleKey)}>
                {fields.map((field) => {
                  const row = diffByField.get(field);
                  return (
                    <ReviewFieldRow
                      key={field}
                      field={field}
                      draft={answers}
                      units={units}
                      formatters={formatters}
                      onChange={change}
                      needsAttention={needsAttention.has(field)}
                      comparison={
                        isProfile && row
                          ? {
                              current: snapshot ? formatAnswer(field, snapshot, formatters) : null,
                              changed: row.changed,
                              kept: kept.has(field),
                              onToggle: () => toggleKept(field),
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </ListGroup>
            );
          })}

          {!isProfile && missing.length > 0 ? (
            <Text
              style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
            >
              {t('aiOnboarding.review.missing', {
                fields: missing.map((field) => t(FIELD_LABEL_KEYS[field])).join(', '),
              })}
            </Text>
          ) : null}

          {warnings.map((warning) => (
            <Text
              key={warning.code}
              style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
            >
              {t(WARNING_KEYS[warning.code])}
            </Text>
          ))}

          {ignoredKeys.length > 0 ? (
            <Text
              style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
            >
              {t('aiOnboarding.review.ignored', { keys: ignoredKeys.join(', ') })}
            </Text>
          ) : null}

          {isProfile ? (
            <View className="gap-3">
              <View className="flex-row">
                <Chip
                  label={t('aiOnboarding.review.recalculate')}
                  role="checkbox"
                  selected={recalculate}
                  onPress={() => setRecalculate((value) => !value)}
                />
              </View>
              <Text
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {t('aiOnboarding.review.recalculateHint')}
              </Text>
              {answers.breakLength ? (
                <TextButton
                  label={t('aiOnboarding.review.openComeback')}
                  onPress={() => router.navigate(COMEBACK_ROUTE as never)}
                />
              ) : null}
            </View>
          ) : null}

          {applyFailed ? (
            <ErrorStateCard
              icon={TriangleAlert}
              title={t('aiOnboarding.review.applyFailedTitle')}
              description={t('aiOnboarding.review.applyFailedBody')}
              buttonLabel={t('common.tryAgain')}
              onButtonPress={apply}
            />
          ) : null}

          <Button
            label={t(
              isProfile ? 'aiOnboarding.review.applyProfile' : 'aiOnboarding.review.applyOnboarding'
            )}
            variant="accent"
            width="full"
            loading={applying}
            disabled={!canApply || applying}
            onPress={apply}
          />

          <View className="items-center">
            <TextButton
              label={t('aiOnboarding.review.back')}
              tone="muted"
              onPress={() =>
                router.navigate(
                  aiSetupRoute(draft.path === 'chat' ? 'chat' : 'external', mode) as never
                )
              }
            />
            <TextButton
              label={t(
                isProfile ? 'aiOnboarding.common.editManually' : 'aiOnboarding.common.backToGuided'
              )}
              tone="muted"
              onPress={goGuided}
            />
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
