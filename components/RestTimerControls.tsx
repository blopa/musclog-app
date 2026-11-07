import { SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { Button } from './theme/Button';

type RestTimerControlsProps = {
  onMinus5s: () => void;
  onSkipRest: () => void;
  onPlus5s: () => void;
};

export function RestTimerControls({ onMinus5s, onSkipRest, onPlus5s }: RestTimerControlsProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // The ±5 s adjusters share one row and Skip takes the full row beneath. Three items side by side
  // left Skip a sliver of a 264pt screen at large text ("Пропустить отдых" cannot fit there).
  return (
    <View className="w-full max-w-sm gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          className="active:bg-bg-card-elevated h-12 flex-1 items-center justify-center rounded-control border bg-bg-overlay/80 active:scale-95"
          style={{ borderColor: theme.colors.overlay.ink5 }}
          onPress={onMinus5s}
        >
          <Text className="text-sm font-semibold text-text-primary">{t('restTimer.minus5s')}</Text>
        </Pressable>

        <Pressable
          className="active:bg-bg-card-elevated h-12 flex-1 items-center justify-center rounded-control border bg-bg-overlay/80 active:scale-95"
          style={{ borderColor: theme.colors.overlay.ink5 }}
          onPress={onPlus5s}
        >
          <Text className="text-sm font-semibold text-text-primary">{t('restTimer.plus5s')}</Text>
        </Pressable>
      </View>

      <Button
        label={t('restTimer.skipRest')}
        icon={SkipForward}
        variant="accent"
        size="md"
        width="full"
        onPress={onSkipRest}
      />
    </View>
  );
}
