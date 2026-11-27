import { useTranslation } from 'react-i18next';

import { PROVIDER_NAME_KEYS } from '@/components/aiOnboarding/providerNames';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import type { GatedAiProvider } from '@/hooks/useAiConsentGate';
import { AI_ACCURACY_CONSENT_KEY, withAiAccuracyConsent } from '@/utils/aiConsent';

type AiProviderConsentModalProps = {
  /** The provider being asked about, or null while nothing is being asked. */
  provider: GatedAiProvider | null;
  onClose: () => void;
  onConfirm: () => void;
};

/** The question asked before the free tier or one of the person's own providers gets any data. */
export function AiProviderConsentModal({
  provider,
  onClose,
  onConfirm,
}: AiProviderConsentModalProps) {
  const { t } = useTranslation();
  const isFreeTier = provider === 'gateway';
  const name = provider ? t(PROVIDER_NAME_KEYS[provider]) : '';

  const ownBody =
    provider === 'local'
      ? t('settings.aiSettings.providerConsent.localBody')
      : t('settings.aiSettings.providerConsent.body', { provider: name });

  return (
    <ConfirmationModal
      visible={provider !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      title={
        isFreeTier
          ? t('settings.aiSettings.musclogFreeTier.consentTitle')
          : t('settings.aiSettings.providerConsent.title', { provider: name })
      }
      message={
        isFreeTier
          ? withAiAccuracyConsent(
              t('settings.aiSettings.musclogFreeTier.consentBody'),
              t(AI_ACCURACY_CONSENT_KEY)
            )
          : withAiAccuracyConsent(ownBody, t(AI_ACCURACY_CONSENT_KEY))
      }
      scrollable
      confirmLabel={
        isFreeTier
          ? t('settings.aiSettings.musclogFreeTier.consentConfirm')
          : t('settings.aiSettings.providerConsent.confirm')
      }
    />
  );
}
