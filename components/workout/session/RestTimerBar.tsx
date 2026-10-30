import { ChevronDown, ChevronUp, Timer } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { hapticBeat, restPhase } from '@/utils/restTimer';
import { playRestBeat } from '@/utils/restTimerHaptics';

/** m:ss with locale digits — the countdown must read the same as every other number in the app. */
export function useClockFormat() {
  const { formatInteger } = useFormatAppNumber();
  return (totalSeconds: number) => {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = formatInteger(Math.floor(seconds / 60), { useGrouping: false });
    const rest = formatInteger(seconds % 60, { useGrouping: false, minimumIntegerDigits: 2 });
    return `${minutes}:${rest}`;
  };
}

/**
 * The rest timer, pinned under the session so it stays visible while any set is being edited or
 * another exercise is being browsed. Collapsed it is one line; expanded it is a large panel that a
 * lifter can read from the bench. The Guided view opens it expanded, without a separate screen.
 */
export function RestTimerBar({
  remaining,
  total,
  defaultRest,
  expanded,
  onToggleExpanded,
  onStart,
  onStop,
  onAdjust,
  onOpenWorkTimer,
}: {
  remaining: number;
  total: number;
  defaultRest: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onStart: () => void;
  onStop: () => void;
  onAdjust: (deltaSeconds: number) => void;
  /** Opens the work timer for a timed set. Omitted while it is already open. Idle rests only. */
  onOpenWorkTimer?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { restTimerHaptics, restHapticStrength, restHeadsUpSeconds } = useSettings();
  const clock = useClockFormat();
  const resting = remaining > 0;
  const phase = restPhase(remaining, total, restHeadsUpSeconds);
  const lastRemaining = useRef<number | null>(null);
  useEffect(() => {
    const previous = lastRemaining.current;
    // A rest no longer than the window has nothing to be warned about (same rule as `restPhase`).
    const beat = hapticBeat(
      previous,
      remaining,
      total > restHeadsUpSeconds ? restHeadsUpSeconds : 0
    );
    lastRemaining.current = remaining;
    // Skipping a rest also lands on 0; only a countdown that actually ran out buzzes.
    const ranOut = beat !== 'done' || (previous != null && previous <= 2);
    if (beat && ranOut && restTimerHaptics) {
      void playRestBeat(beat, restHapticStrength);
    }
  }, [remaining, total, restTimerHaptics, restHapticStrength, restHeadsUpSeconds]);

  const fraction = resting && total > 0 ? Math.min(1, remaining / total) : 0;
  const tone = phase === 'getReady' ? 'text-status-warning' : 'text-text-primary';
  const label = resting
    ? t(phase === 'getReady' ? 'trainingFlow.getReady' : 'trainingFlow.rest')
    : t('trainingFlow.restReady');

  return (
    <View className="border-t border-border-light bg-bg-card" testID="session-rest-timer">
      <View className="h-1 w-full bg-bg-overlay">
        <View
          className={phase === 'getReady' ? 'bg-status-warning' : 'bg-accent-primary'}
          style={{ height: '100%', width: `${fraction * 100}%` }}
        />
      </View>
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} ${resting ? clock(remaining) : ''}`}
          accessibilityState={{ expanded }}
          onPress={onToggleExpanded}
          className="min-h-12 flex-1 flex-row items-center gap-2"
        >
          <Timer
            size={theme.iconSize.md}
            color={resting ? theme.colors.accent.primary : theme.colors.text.secondary}
          />
          <Text className={`text-sm font-semibold ${resting ? tone : 'text-text-secondary'}`}>
            {label}
          </Text>
          {/* Idle, the clock is the length a rest will have — it must not read as a countdown. */}
          <Text
            className={
              resting
                ? `text-xl font-bold tabular-nums ${tone}`
                : 'text-base font-medium tabular-nums text-text-tertiary'
            }
          >
            {resting ? clock(remaining) : clock(defaultRest)}
          </Text>
          {expanded ? (
            <ChevronDown size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
          ) : (
            <ChevronUp size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
          )}
        </Pressable>
        {!resting && onOpenWorkTimer ? (
          <Chip
            variant="solid"
            role="button"
            label={t('workTimer.open')}
            onPress={onOpenWorkTimer}
          />
        ) : null}
        {expanded ? null : (
          <Chip
            variant="solid"
            role="button"
            label={t(resting ? 'trainingFlow.skipRest' : 'trainingFlow.startRest')}
            onPress={resting ? onStop : onStart}
          />
        )}
      </View>
      {expanded ? (
        <View className="items-center gap-4 px-4 pb-5 pt-2">
          <Text
            className={`font-bold tabular-nums ${tone}`}
            style={{ fontSize: theme.typography.fontSize['7xl'], lineHeight: 88 }}
          >
            {clock(resting ? remaining : defaultRest)}
          </Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {resting ? (
              <>
                <Chip
                  variant="solid"
                  role="button"
                  label={t('trainingFlow.minus15')}
                  onPress={() => onAdjust(-15)}
                />
                <Chip
                  variant="solid"
                  role="button"
                  label={t('trainingFlow.plus15')}
                  onPress={() => onAdjust(15)}
                />
                <Chip
                  variant="solid"
                  role="button"
                  label={t('trainingFlow.skipRest')}
                  onPress={onStop}
                  selected
                />
              </>
            ) : (
              <Chip
                variant="solid"
                role="button"
                label={t('trainingFlow.startRest')}
                onPress={onStart}
                selected
              />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
