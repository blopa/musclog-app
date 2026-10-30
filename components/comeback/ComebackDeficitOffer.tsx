import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useSnackbar } from '@/context/SnackbarContext';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { ComebackService } from '@/database/services/ComebackService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import {
  COMEBACK_DEFICIT_OFFER_WEEK,
  type ComebackNutritionTargets,
  wantsComebackDeficit,
} from '@/utils/comeback/comebackNutrition';
import { type ComebackState, tracksNutrition } from '@/utils/comeback/comebackState';
import { handleError } from '@/utils/handleError';

/** Whether the week-2 offer of a small deficit is due: asked for, reached, and not answered yet. */
export function isDeficitOfferDue(state: ComebackState, week: number | null): boolean {
  return (
    state.status === 'active' &&
    tracksNutrition(state.track) &&
    wantsComebackDeficit(state.answers) &&
    state.deficitDecision === null &&
    week !== null &&
    week >= COMEBACK_DEFICIT_OFFER_WEEK
  );
}

/**
 * Weeks 1 and 2 eat at maintenance; from week 2 a small deficit is OFFERED, with the numbers it
 * would mean, and never applied without a tap. Shared by the comeback screen and the Weekly Review's
 * nutrition section, so the offer reads the same wherever it is met.
 */
export function ComebackDeficitOffer({ state }: { state: ComebackState }) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { formatInteger } = useFormatAppNumber();
  const [preview, setPreview] = useState<ComebackNutritionTargets | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ComebackNutritionService.preview(state.answers, { applyDeficit: true })
      .then((targets) => {
        if (!cancelled) {
          setPreview(targets);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [state.answers]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      await handleError(error, 'comebackDeficitOffer', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const accept = () =>
    run(async () => {
      const result = await ComebackService.acceptDeficit();
      if (result.status === 'changedSince') {
        showSnackbar('success', t('comeback.deficit.changedSince'));
      } else if (result.status === 'applied') {
        showSnackbar('success', t('comeback.deficit.applied'));
      }
    });

  return (
    <View
      className="gap-3 rounded-card border border-border-light bg-bg-card p-4"
      testID="comeback-deficit-offer"
    >
      <Text className="text-base font-semibold text-text-primary">
        {t('comeback.deficit.title')}
      </Text>
      <Text className="text-sm text-text-secondary">{t('comeback.deficit.body')}</Text>
      {preview && preview.deficitCalories > 0 ? (
        <Text className="text-sm tabular-nums text-text-primary">
          {t('comeback.deficit.numbers', {
            from: formatInteger(preview.maintenanceCalories),
            to: formatInteger(preview.totalCalories),
            protein: formatInteger(preview.protein),
          })}
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Button
          label={t('comeback.deficit.accept')}
          variant="accent"
          size="md"
          width="flex-1"
          loading={busy}
          disabled={busy || !preview}
          onPress={() => void accept()}
          testID="comeback-deficit-accept"
        />
        <Button
          label={t('comeback.deficit.decline')}
          variant="outline"
          size="md"
          width="flex-1"
          disabled={busy}
          onPress={() => void run(async () => void (await ComebackService.declineDeficit()))}
          testID="comeback-deficit-decline"
        />
      </View>
    </View>
  );
}
