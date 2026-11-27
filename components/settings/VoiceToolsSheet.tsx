import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useTheme } from '@/hooks/useTheme';
import { useVoiceToolLimit } from '@/hooks/useVoiceToolLimit';
import { handleError } from '@/utils/handleError';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import {
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
 * Chooses which voice tools are offered. Chosen tools come first in pick order (the number is the
 * position a model is offered them in); a chosen tool past the model's limit is shown but not used.
 */
export function VoiceToolsSheet({ visible, onClose }: VoiceToolsSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const limit = useVoiceToolLimit();
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

  const handleToggle = (tool: VoiceActionTool) => {
    // An empty selection is one still loading: a tap then must not replace the stored choice.
    const next = selection.length === 0 ? selection : toggleVoiceTool(selection, tool);

    if (next === selection) {
      return;
    }

    setSelection(next);
    SettingsService.set(SETTINGS.voiceCommandTools, serializeVoiceToolSelection(next)).catch(
      (error: unknown) => handleError(error, 'VoiceToolsSheet.save', { showSnackbar: false })
    );
  };

  const unchosen = VOICE_ACTION_TOOLS.filter((tool) => !selection.includes(tool));
  const rows: VoiceActionTool[] = [...selection, ...unchosen];

  return (
    <BottomPopUp visible={visible} onClose={onClose} title={t('voiceInput.tools.sheetTitle')}>
      <View style={{ gap: theme.spacing.gap.md }}>
        <Text
          style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}
        >
          {t('voiceInput.tools.sheetSubtitle')}
        </Text>
        {limit !== undefined ? (
          <Text
            style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}
          >
            {t('voiceInput.tools.limitNote', { count: limit })}
          </Text>
        ) : null}

        {rows.map((tool) => {
          const position = selection.indexOf(tool);
          const isChosen = position !== -1;
          const isNotUsed = isChosen && limit !== undefined && position >= limit;
          const definition = VOICE_TOOLS[tool];

          return (
            <Pressable
              key={tool}
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
                opacity: isNotUsed ? theme.colors.opacity.medium : 1,
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
                {isNotUsed ? (
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
              {isChosen ? (
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
          );
        })}
      </View>
    </BottomPopUp>
  );
}
