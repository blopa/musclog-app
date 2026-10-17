import { Hourglass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useTheme } from '@/hooks/useTheme';

import { useClockFormat } from './RestTimerBar';

/**
 * The work timer, pinned above the rest timer: it counts a timed set (a plank, a hold, an
 * interval) down, where the rest timer counts the recovery after it. Ready, it sets the length;
 * running, it shows the countdown and one way to stop. It does not log the set — the lifter still
 * records what they did — and when it runs out it hands over to the rest timer.
 */
export function WorkTimerBar({
  mode,
  seconds,
  remaining,
  onAdjust,
  onStart,
  onStop,
  onClose,
}: {
  mode: 'ready' | 'running';
  /** The configured length. */
  seconds: number;
  /** What is left while running; equals `seconds` while ready. */
  remaining: number;
  onAdjust: (direction: 1 | -1) => void;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const clock = useClockFormat();
  const running = mode === 'running';
  const fraction = running && seconds > 0 ? Math.min(1, remaining / seconds) : 0;

  return (
    <View className="border-t border-border-light bg-bg-card" testID="session-work-timer">
      <View className="h-1 w-full bg-bg-overlay">
        <View
          className="bg-accent-primary"
          style={{ height: '100%', width: `${fraction * 100}%` }}
        />
      </View>
      <View className="flex-row items-center gap-3 px-4 py-2">
        <View
          className="min-h-12 flex-1 flex-row items-center gap-2"
          accessible
          accessibilityLabel={`${t('workTimer.label')} ${clock(remaining)}`}
        >
          <Hourglass
            size={theme.iconSize.md}
            color={running ? theme.colors.accent.primary : theme.colors.text.secondary}
          />
          <Text
            className={`text-sm font-semibold ${running ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {t('workTimer.label')}
          </Text>
          <Text
            className={`text-xl font-bold ${running ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            {clock(remaining)}
          </Text>
        </View>
        {running ? (
          <Chip
            variant="solid"
            role="button"
            label={t('workTimer.stop')}
            onPress={onStop}
            selected
          />
        ) : (
          <>
            <Chip
              variant="solid"
              role="button"
              label={t('workTimer.minus5')}
              onPress={() => onAdjust(-1)}
            />
            <Chip
              variant="solid"
              role="button"
              label={t('workTimer.plus5')}
              onPress={() => onAdjust(1)}
            />
            <Chip
              variant="solid"
              role="button"
              label={t('workTimer.start')}
              onPress={onStart}
              selected
            />
          </>
        )}
        <Chip variant="solid" role="button" label={t('workTimer.close')} onPress={onClose} />
      </View>
    </View>
  );
}
