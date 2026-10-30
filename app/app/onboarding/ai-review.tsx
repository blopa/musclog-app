import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AiSetupLoading } from '@/components/aiOnboarding/AiSetupLoading';
import {
  FIELD_LABEL_KEYS,
  formatAnswer,
  OPTIONAL_FIELDS,
} from '@/components/aiOnboarding/fieldChoices';
import { ReviewScaffold, useReviewApply } from '@/components/aiOnboarding/ReviewScaffold';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { COMEBACK_ROUTE } from '@/constants/comebackRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import { isDraftLoaded, type LoadedAiDraftApi } from '@/hooks/useAiOnboardingDraft';
import { type AiSetupSession, useAiSetupSession } from '@/hooks/useAiSetupSession';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  applyOnboardingAnswers,
  applyProfileUpdate,
  loadProfileSnapshot,
  type ProfileApplyNote,
} from '@/services/onboardingAnswersApply';
import {
  type FieldKey,
  hasRequiredAnswers,
  missingRequiredFields,
} from '@/utils/aiOnboarding/contract';
import { buildProfileDiff, type ProfileSnapshot } from '@/utils/aiOnboarding/merge';
import { handleError } from '@/utils/handleError';
import { PROFILE_ROUTE } from '@/utils/onboardingRoutes';

const NOTE_KEYS: Record<ProfileApplyNote, string> = {
  gymKept: 'aiOnboarding.review.notes.gymKept',
  daysNotApplied: 'aiOnboarding.review.notes.daysNotApplied',
  comebackNotStarted: 'aiOnboarding.review.notes.comebackNotStarted',
  recalculationSkipped: 'aiOnboarding.review.notes.recalculationSkipped',
};

/**
 * The review: every answer in one place, editable in place, and nothing saved until the person
 * applies it. First-time setup and a profile update share the shell (`ReviewScaffold`) and differ
 * in what they compare against and what applying does, so each is its own body.
 */
export default function AiReviewScreen() {
  const session = useAiSetupSession();
  const { draftApi } = session;

  if (!isDraftLoaded(draftApi)) {
    return <AiSetupLoading />;
  }

  return session.isProfile ? (
    <ProfileReview session={session} draftApi={draftApi} />
  ) : (
    <OnboardingReview session={session} draftApi={draftApi} />
  );
}

type ReviewBodyProps = { session: AiSetupSession; draftApi: LoadedAiDraftApi };

/** Back goes to whichever way the answers were collected: the chat, or the hand-off/import. */
function useBackToCollecting({ session, draftApi }: ReviewBodyProps) {
  const { go } = session;
  const { path } = draftApi.draft;

  return useCallback(() => go(path === 'chat' ? 'chat' : 'external'), [go, path]);
}

function OnboardingReview({ session, draftApi }: ReviewBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { useBfForCalculations } = useSettings();
  const { draft } = draftApi;
  const answers = draft.answers;
  const goBack = useBackToCollecting({ session, draftApi });

  const missing = useMemo(() => missingRequiredFields(answers), [answers]);
  // Answers an import carried but the validator rejected: outlined like a missing one.
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

  const canApply = missing.length === 0 && hasRequiredAnswers(answers);

  const apply = useReviewApply(
    useCallback(async () => {
      if (!hasRequiredAnswers(answers)) {
        return;
      }

      const result = await applyOnboardingAnswers(answers, {
        draftId: draft.draftId,
        skipMusclogApi: draft.skipMusclogApi,
        useBodyFat: useBfForCalculations,
      });
      draftApi.discard();
      router.replace(result.nextRoute as never);
    }, [answers, draft.draftId, draft.skipMusclogApi, draftApi, router, useBfForCalculations])
  );

  return (
    <ReviewScaffold
      draftApi={draftApi}
      introKey={session.copy.reviewIntroKey}
      applyKey={session.copy.applyKey}
      exitKey={session.copy.exitKey}
      canApply={canApply}
      apply={apply}
      onBack={goBack}
      onExit={session.goGuided}
      rowExtras={(field) => ({ needsAttention: needsAttention.has(field) })}
      beforeWarnings={
        missing.length > 0 ? (
          <Text
            style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
          >
            {t('aiOnboarding.review.missing', {
              fields: missing.map((field) => t(FIELD_LABEL_KEYS[field])).join(', '),
            })}
          </Text>
        ) : null
      }
    />
  );
}

function ProfileReview({ session, draftApi }: ReviewBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { useBfForCalculations } = useSettings();
  const { draft } = draftApi;
  const answers = draft.answers;
  const goBack = useBackToCollecting({ session, draftApi });

  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<FieldKey>>(new Set());
  const [recalculate, setRecalculate] = useState(false);

  useEffect(() => {
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
  }, []);

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

  const toggleKept = (field: FieldKey) =>
    setSkipped((previous) => {
      const next = new Set(previous);
      if (!next.delete(field)) {
        next.add(field);
      }

      return next;
    });

  const canApply = snapshot !== null && kept.size > 0;

  const apply = useReviewApply(
    useCallback(async () => {
      if (!canApply) {
        return;
      }

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
    }, [
      answers,
      draft.draftId,
      draftApi,
      canApply,
      kept,
      recalculate,
      router,
      showSnackbar,
      t,
      useBfForCalculations,
    ])
  );

  return (
    <ReviewScaffold
      draftApi={draftApi}
      introKey={session.copy.reviewIntroKey}
      applyKey={session.copy.applyKey}
      exitKey={session.copy.exitKey}
      canApply={canApply}
      apply={apply}
      onBack={goBack}
      onExit={session.goGuided}
      loading={snapshot === null}
      isVisible={(field) => diffByField.has(field)}
      rowExtras={(field, formatters) => {
        const row = diffByField.get(field);

        return row
          ? {
              comparison: {
                current: snapshot ? formatAnswer(field, snapshot, formatters) : null,
                changed: row.changed,
                kept: kept.has(field),
                onToggle: () => toggleKept(field),
              },
            }
          : {};
      }}
      afterWarnings={
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
            style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
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
      }
    />
  );
}
