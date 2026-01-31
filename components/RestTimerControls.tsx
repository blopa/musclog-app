import { SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../theme';
import { Button } from './theme/Button';

type RestTimerControlsProps = {
  onMinus5s: () => void;
  onSkipRest: () => void;
  onPlus5s: () => void;
};

export function RestTimerControls({ onMinus5s, onSkipRest, onPlus5s }: RestTimerControlsProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full max-w-sm flex-row items-center justify-center gap-4">
      <Pressable
        className="active:bg-bg-card-elevated h-12 items-center justify-center rounded-xl border bg-bg-overlay/80 active:scale-95"
        style={{ minWidth: theme.size['18'], borderColor: theme.colors.overlay.white5 }}
        onPress={onMinus5s}
      >
        <Text className="text-sm font-bold text-text-primary">{t('restTimer.minus5s')}</Text>
      </Pressable>

      <Button
        label={t('restTimer.skipRest')}
        icon={SkipForward}
        variant="accent"
        size="md"
        width="flex-1"
        onPress={onSkipRest}
      />

      <Pressable
        className="active:bg-bg-card-elevated h-12 items-center justify-center rounded-xl border bg-bg-overlay/80 active:scale-95"
        style={{ minWidth: theme.size['18'], borderColor: theme.colors.overlay.white5 }}
        onPress={onPlus5s}
      >
        <Text className="text-sm font-bold text-text-primary">{t('restTimer.plus5s')}</Text>
      </Pressable>
    </View>
  );
}
