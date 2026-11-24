import { Cpu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useThinkingLevelChange } from '@/components/ai/useThinkingLevelChange';
import { BottomPopUp } from '@/components/BottomPopUp';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { ListRow } from '@/components/theme/ListRow';
import type { AiProviderKind } from '@/constants/ai';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { THINKING_LEVELS, type ThinkingLevel } from '@/utils/aiThinkingLevel';

type ThinkingLevelPickerProps = {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
  /** The active provider; the free tier allows no thinking. */
  provider: AiProviderKind | null;
  /** Host modal visibility; closes the picker sheet and confirmation dialog when the parent closes. */
  parentVisible?: boolean;
};

// Whole-key tables: check-translations cannot see keys built from a template string.
const LEVEL_NAME_KEYS: Record<ThinkingLevel, string> = {
  off: 'settings.aiSettings.thinkingLevel.levels.off.name',
  medium: 'settings.aiSettings.thinkingLevel.levels.medium.name',
  high: 'settings.aiSettings.thinkingLevel.levels.high.name',
  tokenmaxxing: 'settings.aiSettings.thinkingLevel.levels.tokenmaxxing.name',
};
const LEVEL_DESCRIPTION_KEYS: Record<ThinkingLevel, string> = {
  off: 'settings.aiSettings.thinkingLevel.levels.off.description',
  medium: 'settings.aiSettings.thinkingLevel.levels.medium.description',
  high: 'settings.aiSettings.thinkingLevel.levels.high.description',
  tokenmaxxing: 'settings.aiSettings.thinkingLevel.levels.tokenmaxxing.description',
};
const IRON_NOTE_KEYS: Record<ThinkingLevel, string | null> = {
  off: null,
  medium: 'settings.aiSettings.thinkingLevel.ironNote.medium',
  high: 'settings.aiSettings.thinkingLevel.ironNote.high',
  tokenmaxxing: 'settings.aiSettings.thinkingLevel.ironNote.tokenmaxxing',
};

const CONFIRM_HIGH = {
  title: 'settings.aiSettings.thinkingLevel.confirmHigh.title',
  message: 'settings.aiSettings.thinkingLevel.confirmHigh.message',
  confirm: 'settings.aiSettings.thinkingLevel.confirmHigh.confirm',
};
const CONFIRM_TOKENMAXXING = {
  title: 'settings.aiSettings.thinkingLevel.confirmTokenmaxxing.title',
  message: 'settings.aiSettings.thinkingLevel.confirmTokenmaxxing.message',
  confirm: 'settings.aiSettings.thinkingLevel.confirmTokenmaxxing.confirm',
};

/** The settings row for how hard the AI thinks: four levels, with the notes each provider needs. */
export function ThinkingLevelPicker({
  value,
  onChange,
  provider,
  parentVisible = true,
}: ThinkingLevelPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useSubModalVisibility(parentVisible);
  const { allowed, pending, request, cancel, confirm } = useThinkingLevelChange({
    value,
    provider,
    onChange,
    authPrompt: t('settings.aiSettings.thinkingLevel.confirmTokenmaxxing.authPrompt'),
    parentVisible,
  });

  const describe = (level: ThinkingLevel) => {
    const parts = [t(LEVEL_DESCRIPTION_KEYS[level])];
    const ironKey = IRON_NOTE_KEYS[level];

    if (provider === 'hosted' && ironKey) {
      parts.push(t(ironKey));
    }

    return parts.join(' ');
  };

  let subtitle = describe(value);

  if (!allowed) {
    subtitle = t('settings.aiSettings.thinkingLevel.freeTierNote');
  } else if (provider === 'on-device') {
    subtitle = `${subtitle} ${t('settings.aiSettings.thinkingLevel.onDeviceNote')}`;
  }

  const pick = (level: ThinkingLevel) => {
    setSheetOpen(false);
    request(level);
  };

  const confirmCopy = pending?.auth ? CONFIRM_TOKENMAXXING : CONFIRM_HIGH;

  let panel = null;

  if (sheetOpen) {
    panel = (
      <BottomPopUp
        visible
        onClose={() => setSheetOpen(false)}
        title={t('settings.aiSettings.thinkingLevel.label')}
      >
        <View className="gap-2 pb-4">
          {THINKING_LEVELS.map((level) => (
            <ListRow
              key={level}
              variant="card"
              title={t(LEVEL_NAME_KEYS[level])}
              subtitle={describe(level)}
              selected={level === value}
              onPress={() => pick(level)}
              testID={`thinking-level-${level}`}
            />
          ))}
        </View>
      </BottomPopUp>
    );
  } else if (pending) {
    panel = (
      <ConfirmationModal
        visible
        scrollable
        onClose={cancel}
        onConfirm={confirm}
        title={t(confirmCopy.title)}
        message={t(confirmCopy.message)}
        confirmLabel={t(confirmCopy.confirm)}
        variant="primary"
      />
    );
  }

  return (
    <View style={{ opacity: allowed ? 1 : 0.5 }}>
      <ListRow
        variant="card"
        title={t('settings.aiSettings.thinkingLevel.label')}
        subtitle={subtitle}
        value={t(LEVEL_NAME_KEYS[value])}
        disabled={!allowed}
        onPress={() => setSheetOpen(true)}
        testID="thinking-level-row"
        leading={
          <View
            style={{
              width: theme.size['8'],
              height: theme.size['8'],
              borderRadius: theme.borderRadius.full / 2,
              backgroundColor: theme.colors.status.indigo10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cpu size={theme.iconSize.md} color={theme.colors.status.indigo} />
          </View>
        }
      />
      {panel}
    </View>
  );
}
