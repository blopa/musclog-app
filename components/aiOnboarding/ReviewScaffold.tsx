import { TriangleAlert } from 'lucide-react-native';
import { type ComponentProps, type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { type AnswerFormatters, REVIEW_SECTIONS } from '@/components/aiOnboarding/fieldChoices';
import { ReviewFieldRow } from '@/components/aiOnboarding/ReviewFieldRow';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { ListGroup } from '@/components/theme/ListGroup';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextButton } from '@/components/theme/TextButton';
import type { LoadedAiDraftApi } from '@/hooks/useAiOnboardingDraft';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  type AnswerWarning,
  crossFieldWarnings,
  type FieldKey,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { formatLocalCalendarDayNumericIntl, parseLocalCalendarDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

const WARNING_KEYS: Record<AnswerWarning['code'], string> = {
  weightGoalConflictsFocus: 'aiOnboarding.review.warnings.weightGoalConflictsFocus',
  dobAgeMismatch: 'aiOnboarding.review.warnings.dobAgeMismatch',
  comebackStartsAtMaintenance: 'aiOnboarding.review.warnings.comebackStartsAtMaintenance',
  unusualBodyMeasurements: 'aiOnboarding.review.warnings.unusualBodyMeasurements',
};

/** Per-row extras a review mode adds: the attention outline, or a comparison with what is saved. */
type RowExtras = Pick<ComponentProps<typeof ReviewFieldRow>, 'needsAttention' | 'comparison'>;

/**
 * The apply button's state: one run at a time, and a failure that stays visible (with a retry)
 * until the person edits an answer or tries again.
 */
export function useReviewApply(work: () => Promise<void>) {
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);

  const apply = useCallback(async () => {
    if (applying) {
      return;
    }

    setApplying(true);
    setFailed(false);
    try {
      await work();
    } catch (error) {
      handleError(error, 'AiReviewScreen.apply');
      setFailed(true);
    } finally {
      setApplying(false);
    }
  }, [applying, work]);

  const clearFailure = useCallback(() => setFailed(false), []);

  return { applying, failed, apply, clearFailure };
}

type ReviewScaffoldProps = {
  draftApi: LoadedAiDraftApi;
  introKey: string;
  applyKey: string;
  exitKey: string;
  canApply: boolean;
  apply: ReturnType<typeof useReviewApply>;
  onBack: () => void;
  onExit: () => void;
  /** Shows a spinner under the intro while the mode is still loading what it compares against. */
  loading?: boolean;
  /** Fields the mode lists; every field of a section by default. */
  isVisible?: (field: FieldKey) => boolean;
  rowExtras?: (field: FieldKey, formatters: AnswerFormatters) => RowExtras;
  /** Mode-specific content between the answers and the warnings. */
  beforeWarnings?: ReactNode;
  /** Mode-specific content between the warnings and the apply button. */
  afterWarnings?: ReactNode;
};

/**
 * The review shell both modes share: every answer in one place, editable in place, warnings, and
 * one apply button. Nothing is saved until the person applies; what applying does, and what each
 * row compares against, is the mode's own (`OnboardingReview`, `ProfileReview`).
 */
export function ReviewScaffold({
  draftApi,
  introKey,
  applyKey,
  exitKey,
  canApply,
  apply,
  onBack,
  onExit,
  loading = false,
  isVisible = () => true,
  rowExtras,
  beforeWarnings,
  afterWarnings,
}: ReviewScaffoldProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { units: settingsUnits } = useSettings();
  const { formatDecimal } = useFormatAppNumber();
  const { draft } = draftApi;
  const answers = draft.answers;
  const units = answers.units ?? settingsUnits;
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

  const warnings = useMemo(() => crossFieldWarnings(answers), [answers]);
  const ignoredKeys = draft.importNotes?.ignoredKeys ?? [];

  const change = useCallback(
    (next: OnboardingAnswersDraft) => {
      apply.clearFailure();
      void draftApi.update({ answers: next });
    },
    [apply, draftApi]
  );

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
            {t(introKey)}
          </Text>

          {loading ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}

          {REVIEW_SECTIONS.map((section) => {
            const fields = section.fields.filter(isVisible);
            if (fields.length === 0) {
              return null;
            }

            return (
              <ListGroup key={section.titleKey} title={t(section.titleKey)}>
                {fields.map((field) => (
                  <ReviewFieldRow
                    key={field}
                    field={field}
                    draft={answers}
                    units={units}
                    formatters={formatters}
                    onChange={change}
                    {...rowExtras?.(field, formatters)}
                  />
                ))}
              </ListGroup>
            );
          })}

          {beforeWarnings}

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

          {afterWarnings}

          {apply.failed ? (
            <ErrorStateCard
              icon={TriangleAlert}
              title={t('aiOnboarding.review.applyFailedTitle')}
              description={t('aiOnboarding.review.applyFailedBody')}
              buttonLabel={t('common.tryAgain')}
              onButtonPress={apply.apply}
            />
          ) : null}

          <Button
            label={t(applyKey)}
            variant="accent"
            width="full"
            loading={apply.applying}
            disabled={!canApply || apply.applying}
            onPress={apply.apply}
          />

          <View className="items-center">
            <TextButton label={t('aiOnboarding.review.back')} tone="muted" onPress={onBack} />
            <TextButton label={t(exitKey)} tone="muted" onPress={onExit} />
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
