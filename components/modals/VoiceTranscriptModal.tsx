import { useTranslation } from 'react-i18next';
import { Linking, Platform, Text, View } from 'react-native';

import { CenteredModal } from '@/components/modals/CenteredModal';
import { Button } from '@/components/theme/Button';
import type { HoldToTranscribeOutcome } from '@/hooks/useHoldToTranscribe';
import type { VoiceFailure } from '@/utils/voiceInput';

type VoiceTranscriptModalProps = {
  /** What the last hold produced; the modal is open exactly while this is set. */
  outcome: HoldToTranscribeOutcome | null;
  onClose: () => void;
  /** Android only: asks the system to download the speech model. */
  onDownloadLanguage: () => void;
};

const FAILURE_COPY: Record<VoiceFailure, { titleKey: string; messageKey: string }> = {
  permission: {
    titleKey: 'voiceInput.failure.permission.title',
    messageKey: 'voiceInput.failure.permission.message',
  },
  // The message depends on the platform: see `failureMessageKey`.
  languageMissing: {
    titleKey: 'voiceInput.failure.languageMissing.title',
    messageKey: 'voiceInput.failure.languageMissing.messageIos',
  },
  unavailable: {
    titleKey: 'voiceInput.failure.unavailable.title',
    messageKey: 'voiceInput.failure.unavailable.message',
  },
  nothingHeard: {
    titleKey: 'voiceInput.failure.nothingHeard.title',
    messageKey: 'voiceInput.failure.nothingHeard.message',
  },
  failed: {
    titleKey: 'voiceInput.failure.failed.title',
    messageKey: 'voiceInput.failure.failed.message',
  },
};

const LANGUAGE_MISSING_ANDROID_MESSAGE_KEY = 'voiceInput.failure.languageMissing.messageAndroid';

function failureMessageKey(failure: VoiceFailure): string {
  if (failure === 'languageMissing' && Platform.OS === 'android') {
    return LANGUAGE_MISSING_ANDROID_MESSAGE_KEY;
  }

  return FAILURE_COPY[failure].messageKey;
}

/**
 * The result of a voice hold: the transcript with an OK, or why there is none (with the one action
 * that can fix it). Rendered by `VoiceNavButton`, inside its own tree.
 */
export function VoiceTranscriptModal({
  outcome,
  onClose,
  onDownloadLanguage,
}: VoiceTranscriptModalProps) {
  const { t } = useTranslation();
  const failure = outcome?.kind === 'failure' ? outcome.failure : null;

  let title = '';
  if (outcome?.kind === 'text') {
    title = t('voiceInput.resultTitle');
  } else if (failure) {
    title = t(FAILURE_COPY[failure].titleKey);
  }

  const footer = (
    <View className="flex-row flex-wrap gap-3">
      {failure === 'permission' ? (
        <View className="grow basis-[140px]">
          <Button
            label={t('voiceInput.openSettings')}
            variant="outline"
            size="md"
            width="full"
            onPress={() => {
              void Linking.openSettings();
              onClose();
            }}
          />
        </View>
      ) : null}
      {failure === 'languageMissing' && Platform.OS === 'android' ? (
        <View className="grow basis-[140px]">
          <Button
            label={t('voiceInput.downloadLanguage')}
            variant="outline"
            size="md"
            width="full"
            onPress={onDownloadLanguage}
          />
        </View>
      ) : null}
      <View className="grow basis-[140px]">
        <Button label={t('common.ok')} variant="accent" size="md" width="full" onPress={onClose} />
      </View>
    </View>
  );

  return (
    <CenteredModal
      visible={outcome !== null}
      onClose={onClose}
      title={title}
      footer={footer}
      scrollable
    >
      {outcome?.kind === 'text' ? (
        <Text selectable className="text-base text-text-primary">
          {outcome.text}
        </Text>
      ) : null}
      {failure ? (
        <Text className="text-base text-text-primary">{t(failureMessageKey(failure))}</Text>
      ) : null}
    </CenteredModal>
  );
}
