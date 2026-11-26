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
  /** Web only: accepts that the browser does the speech recognition. */
  onAllowBrowser: () => void;
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
  browserNotice: {
    titleKey: 'voiceInput.failure.browserNotice.title',
    messageKey: 'voiceInput.failure.browserNotice.message',
  },
};

/** The failures whose phone wording (settings, downloads, offline) is wrong in a browser. */
const WEB_FAILURE_COPY: Partial<Record<VoiceFailure, { titleKey: string; messageKey: string }>> = {
  permission: {
    titleKey: 'voiceInput.failure.permission.title',
    messageKey: 'voiceInput.failure.permission.messageWeb',
  },
  languageMissing: {
    titleKey: 'voiceInput.failure.languageMissing.titleWeb',
    messageKey: 'voiceInput.failure.languageMissing.messageWeb',
  },
  unavailable: {
    titleKey: 'voiceInput.failure.unavailable.titleWeb',
    messageKey: 'voiceInput.failure.unavailable.messageWeb',
  },
};

const LANGUAGE_MISSING_ANDROID_MESSAGE_KEY = 'voiceInput.failure.languageMissing.messageAndroid';

function failureCopy(failure: VoiceFailure): { titleKey: string; messageKey: string } {
  if (Platform.OS === 'web') {
    return WEB_FAILURE_COPY[failure] ?? FAILURE_COPY[failure];
  }

  if (failure === 'languageMissing' && Platform.OS === 'android') {
    return { ...FAILURE_COPY[failure], messageKey: LANGUAGE_MISSING_ANDROID_MESSAGE_KEY };
  }

  return FAILURE_COPY[failure];
}

/**
 * The result of a voice hold: the transcript with an OK, or why there is none (with the one action
 * that can fix it). Rendered by `VoiceNavButton`, inside its own tree.
 */
export function VoiceTranscriptModal({
  outcome,
  onClose,
  onDownloadLanguage,
  onAllowBrowser,
}: VoiceTranscriptModalProps) {
  const { t } = useTranslation();
  const failure = outcome?.kind === 'failure' ? outcome.failure : null;

  let title = '';
  if (outcome?.kind === 'text') {
    title = t('voiceInput.resultTitle');
  } else if (failure) {
    title = t(failureCopy(failure).titleKey);
  }

  const footer = (
    <View className="flex-row flex-wrap gap-3">
      {failure === 'permission' && Platform.OS !== 'web' ? (
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
      {failure === 'browserNotice' ? (
        <>
          <View className="grow basis-[140px]">
            <Button
              label={t('voiceInput.notNow')}
              variant="outline"
              size="md"
              width="full"
              onPress={onClose}
            />
          </View>
          <View className="grow basis-[140px]">
            <Button
              label={t('voiceInput.allow')}
              variant="accent"
              size="md"
              width="full"
              onPress={onAllowBrowser}
            />
          </View>
        </>
      ) : (
        <View className="grow basis-[140px]">
          <Button
            label={t('common.ok')}
            variant="accent"
            size="md"
            width="full"
            onPress={onClose}
          />
        </View>
      )}
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
        <Text className="text-base text-text-primary">{t(failureCopy(failure).messageKey)}</Text>
      ) : null}
    </CenteredModal>
  );
}
