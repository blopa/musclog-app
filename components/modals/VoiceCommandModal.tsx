import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { CenteredModal } from '@/components/modals/CenteredModal';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { useTheme } from '@/hooks/useTheme';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

export type VoiceCommandModalState =
  /** The model is working out what the sentence asks for. */
  | { kind: 'working'; transcript: string }
  /** No tool could be run from what was said: the person says which one they meant. */
  | { kind: 'pick'; transcript: string };

type VoiceCommandModalProps = {
  /** The modal is open exactly while this is set. */
  state: VoiceCommandModalState | null;
  /** Abandons the request while working, and closes the picker. */
  onCancel: () => void;
  onAskCoach: (transcript: string) => void;
  onPickTool: (transcript: string, tool: VoiceActionTool) => void;
};

/**
 * Both stages of a voice command that need the person's attention, in one modal: waiting for the
 * answer (cancellable), and picking the tool they meant when no command could be run.
 */
export function VoiceCommandModal({
  state,
  onCancel,
  onAskCoach,
  onPickTool,
}: VoiceCommandModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isWorking = state?.kind === 'working';

  const cancelButton = (
    <Button
      label={t('common.cancel')}
      variant="outline"
      size="md"
      width="full"
      onPress={onCancel}
    />
  );

  const footer = isWorking ? (
    cancelButton
  ) : (
    <View className="flex-row flex-wrap gap-3">
      <View className="grow basis-[140px]">{cancelButton}</View>
      <View className="grow basis-[140px]">
        <Button
          label={t('voiceInput.command.askCoach')}
          variant="outline"
          size="md"
          width="full"
          onPress={() => (state ? onAskCoach(state.transcript) : undefined)}
        />
      </View>
    </View>
  );

  return (
    <CenteredModal
      visible={state !== null}
      onClose={onCancel}
      title={t(isWorking ? 'voiceInput.command.workingTitle' : 'voiceInput.command.pickTitle')}
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
            <Text className="text-sm text-text-secondary">{t('voiceInput.command.pickHint')}</Text>
            {VOICE_ACTION_TOOLS.map((name) => (
              <ListRow
                key={name}
                variant="filled"
                title={t(VOICE_TOOLS[name].titleKey)}
                subtitle={t(VOICE_TOOLS[name].labelKey)}
                onPress={() => (state ? onPickTool(state.transcript, name) : undefined)}
              />
            ))}
          </View>
        )}
      </View>
    </CenteredModal>
  );
}
