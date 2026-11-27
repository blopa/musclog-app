import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '@/context/SnackbarContext';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { isCloudAiBlockedForAge } from '@/services/aiAccess';
import { recordAiConsent } from '@/services/aiConsentRecord';
import { MINIMUM_CLOUD_AI_AGE } from '@/utils/ageGate';
import { hasCurrentAiConsent, type OwnAiProvider } from '@/utils/aiConsent';
import { handleError } from '@/utils/handleError';

/** The AI options this gate asks about. Musclog Iron has its own consent inside its screen. */
export type GatedAiProvider = OwnAiProvider | 'gateway';

type Pending = { provider: GatedAiProvider; run: () => void };

/**
 * Asks before an AI option starts receiving data. `request` runs the action straight away when the
 * person already agreed to the current wording for that provider; the free tier is asked every
 * time it is turned on, and never offered to someone under 18.
 */
export function useAiConsentGate() {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [pending, setPending] = useState<Pending | null>(null);

  const request = useCallback(
    async (provider: GatedAiProvider, run: () => void) => {
      try {
        if (provider === 'gateway') {
          if (await isCloudAiBlockedForAge()) {
            showSnackbar('error', t('common.ageGate.cloudAi', { age: MINIMUM_CLOUD_AI_AGE }));
            return;
          }
        } else if (
          hasCurrentAiConsent(await SettingsService.get(SETTINGS.aiConsentRecords), provider)
        ) {
          run();
          return;
        }
      } catch (error) {
        // Not knowing is a reason to ask, never to skip the question.
        handleError(error, 'useAiConsentGate.request', { showSnackbar: false });
      }

      setPending({ provider, run });
    },
    [showSnackbar, t]
  );

  // The consent is written before the action runs, so an action never starts without a record.
  // If the record cannot be written, the action does not run and the person is told.
  const confirm = useCallback(async () => {
    if (!pending) {
      return;
    }

    const { provider, run } = pending;
    setPending(null);

    try {
      await recordAiConsent(provider);
    } catch (error) {
      await handleError(error, 'useAiConsentGate.record');
      return;
    }

    run();
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  return { provider: pending?.provider ?? null, request, confirm, cancel };
}
