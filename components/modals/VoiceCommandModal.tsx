import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { CenteredModal } from '@/components/modals/CenteredModal';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';

export type VoiceCommandModalState =
  /** The model is working out what the sentence asks for. */
  | { kind: 'working'; transcript: string }
  /** What was said is not something voice can do. */
  | { kind: 'unmatched'; transcript: string };

type VoiceCommandModalProps = {
  /** The modal is open exactly while this is set. */
  state: VoiceCommandModalState | null;
  onCancel: () => void;
  onClose: () => void;
  onAskCoach: (transcript: string) => void;
};

/**
 * Both stages of a voice command that need the person's attention, in one modal: waiting for the
 * answer (cancellable), and saying what voice can do when the sentence was not a command.
 */
export function VoiceCommandModal({
  state,
  onCancel,
  onClose,
  onAskCoach,
}: VoiceCommandModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isWorking = state?.kind === 'working';

  const footer = isWorking ? (
    <Button
      label={t('common.cancel')}
      variant="outline"
      size="md"
      width="full"
      onPress={onCancel}
    />
  ) : (
    <View className="flex-row flex-wrap gap-3">
      <View className="grow basis-[140px]">
        <Button
          label={t('voiceInput.command.askCoach')}
          variant="outline"
          size="md"
          width="full"
          onPress={() => (state ? onAskCoach(state.transcript) : undefined)}
        />
      </View>
      <View className="grow basis-[140px]">
        <Button label={t('common.ok')} variant="accent" size="md" width="full" onPress={onClose} />
      </View>
    </View>
  );

  return (
    <CenteredModal
      visible={state !== null}
      onClose={isWorking ? onCancel : onClose}
      title={
        isWorking ? t('voiceInput.command.workingTitle') : t('voiceInput.command.unmatchedTitle')
      }
      footer={footer}
      scrollable
    >
      <View className="gap-4">
        <Text selectable className="text-base text-text-primary">
          {state?.transcript}
        </Text>
        {isWorking ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <View className="gap-2">
            <Text className="text-sm text-text-secondary">{t('voiceInput.command.canSay')}</Text>
            {Object.entries(VOICE_TOOLS).map(([name, tool]) => (
              <Text key={name} className="text-sm text-text-primary">
                {t(tool.labelKey)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </CenteredModal>
  );
}
