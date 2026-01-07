import { View, Text, Pressable } from 'react-native';
import { SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

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
        className="active:bg-bg-card-elevated h-12 min-w-[72px] items-center justify-center rounded-xl border bg-bg-overlay/80 active:scale-95"
        style={{ borderColor: theme.colors.overlay.white5 }}
        onPress={onMinus5s}>
        <Text className="text-sm font-bold text-text-primary">{t('restTimer.minus5s')}</Text>
      </Pressable>

      <Pressable
        className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent-primary active:scale-95 active:opacity-90"
        onPress={onSkipRest}>
        <SkipForward size={theme.iconSize.md} color={theme.colors.text.black} />
        <Text className="text-text-black font-bold uppercase tracking-wide">
          {t('restTimer.skipRest')}
        </Text>
      </Pressable>

      <Pressable
        className="active:bg-bg-card-elevated h-12 min-w-[72px] items-center justify-center rounded-xl border bg-bg-overlay/80 active:scale-95"
        style={{ borderColor: theme.colors.overlay.white5 }}
        onPress={onPlus5s}>
        <Text className="text-sm font-bold text-text-primary">{t('restTimer.plus5s')}</Text>
      </Pressable>
    </View>
  );
}
