import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { useHasCamera } from '@/components/CameraView';
import { TextButton } from '@/components/theme/TextButton';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useTheme } from '@/hooks/useTheme';
import { useVoiceToolLimit } from '@/hooks/useVoiceToolLimit';
import { handleError } from '@/utils/handleError';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import {
  DEFAULT_VOICE_TOOL_SELECTION,
  isVoiceToolOnDevice,
  isVoiceToolSupported,
  parseVoiceToolSelection,
  serializeVoiceToolSelection,
  toggleVoiceTool,
} from '@/utils/voiceCommand/toolSelection';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

type VoiceToolsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Chooses which voice tools are offered. Tools this device cannot run (no camera) are hidden.
 * Chosen tools come first in pick order, and the number on a row is the position a model is offered
 * it in. A divider marks the first chosen tool past the model's limit: those are kept but not used,
 * and a tool the downloaded model is not offered shows a note instead of a number. A text button
 * restores the recommended order when the choice differs from it.
 */
export function VoiceToolsSheet({ visible, onClose }: VoiceToolsSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hasCamera = useHasCamera();
  const { max, nativeModel } = useVoiceToolLimit();
  const [selection, setSelection] = useState<readonly VoiceActionTool[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    void SettingsService.get(SETTINGS.voiceCommandTools).then((raw) => {
      if (!cancelled) {
        setSelection(parseVoiceToolSelection(raw));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const onDevice = (tool: VoiceActionTool) => isVoiceToolOnDevice(tool, hasCamera);
  const supported = (tool: VoiceActionTool) => isVoiceToolSupported(tool, nativeModel);

  const handleToggle = (tool: VoiceActionTool) => {
    // An empty selection is one still loading: a tap then must not replace the stored choice.
    const next =
      selection.length === 0
        ? selection
        : toggleVoiceTool(selection, tool, (name) => onDevice(name) && supported(name));

    if (next === selection) {
      return;
    }

    setSelection(next);
    SettingsService.set(SETTINGS.voiceCommandTools, serializeVoiceToolSelection(next)).catch(
      (error: unknown) => handleError(error, 'VoiceToolsSheet.save', { showSnackbar: false })
    );
  };

  const handleUseRecommended = () => {
    setSelection([...DEFAULT_VOICE_TOOL_SELECTION]);
    SettingsService.resetToDefaults([SETTINGS.voiceCommandTools]).catch((error: unknown) =>
      handleError(error, 'VoiceToolsSheet.reset', { showSnackbar: false })
    );
  };

  const visibleChosen = selection.filter(onDevice);
  const unchosen = VOICE_ACTION_TOOLS.filter((tool) => onDevice(tool) && !selection.includes(tool));
  const rows: VoiceActionTool[] = [...visibleChosen, ...unchosen];

  // The chosen tools the model is offered, in pick order: the first `max` of them are used.
  const counted = visibleChosen.filter(supported);
  const dividerTool = max !== undefined && counted.length > max ? counted[max] : undefined;
  const isRecommended =
    serializeVoiceToolSelection(selection) ===
    serializeVoiceToolSelection(DEFAULT_VOICE_TOOL_SELECTION);

  return (
    <BottomPopUp visible={visible} onClose={onClose} title={t('voiceInput.tools.sheetTitle')}>
      <View style={{ gap: theme.spacing.gap.md }}>
        <Text
          style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}
        >
          {t('voiceInput.tools.sheetSubtitle')}
        </Text>
        {max !== undefined ? (
          <Text
            style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}
          >
            {t('voiceInput.tools.limitNote', { count: max })}
          </Text>
        ) : null}

        {rows.map((tool) => {
          const isChosen = selection.includes(tool);
          const position = counted.indexOf(tool);
          const isUnsupported = !supported(tool);
          const definition = VOICE_TOOLS[tool];

          return (
            <View key={tool} style={{ gap: theme.spacing.gap.md }}>
              {tool === dividerTool ? (
                <View
                  style={{
                    borderTopWidth: theme.borderWidth.thin,
                    borderTopColor: theme.colors.border.light,
                    paddingTop: theme.spacing.padding.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.tertiary,
                    }}
                  >
                    {t('voiceInput.tools.notUsed')}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChosen }}
                onPress={() => handleToggle(tool)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.base,
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: isChosen ? theme.colors.accent.primary : theme.colors.border.light,
                  backgroundColor: theme.colors.background.card,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {t(definition.titleKey)}
                  </Text>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {t(definition.labelKey)}
                  </Text>
                  {isUnsupported ? (
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.text.tertiary,
                      }}
                    >
                      {t('voiceInput.tools.notUsed')}
                    </Text>
                  ) : null}
                </View>
                {isChosen && !isUnsupported ? (
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.accent.primary,
                    }}
                  >
                    {position + 1}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}

        {selection.length > 0 && !isRecommended ? (
          <TextButton label={t('voiceInput.tools.useRecommended')} onPress={handleUseRecommended} />
        ) : null}
      </View>
    </BottomPopUp>
  );
}
