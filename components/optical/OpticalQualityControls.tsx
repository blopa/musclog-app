/**
 * Optical transfer — the "it isn't scanning" escape hatch.
 *
 * WHY THIS EXISTS AT ALL: the sender can measure its own encode speed, but whether a code is
 * readable depends entirely on the *other* phone's camera — its sensor, its autofocus, the light
 * in the room, how steady the hands are. None of that is observable from here, so no amount of
 * calibration can get it right for every pair of phones. The only party who can see the problem is
 * the person holding both, so they get the knobs.
 *
 * DESIGN CONSTRAINTS, in the order they mattered:
 *
 *  - It has to be reachable WHILE STREAMING. You discover the transfer is stuck by watching the
 *    other phone sit at 0%; making the user stop, back out, change a setting and start over is
 *    exactly the moment they give up.
 *  - It has to stay collapsed by default. Most transfers work, and two knobs in the face of
 *    someone whose transfer is fine is noise.
 *  - Two steppers, not a settings screen. Each is one axis with a plain-language current value,
 *    so there is nothing to read and nothing to understand before touching it.
 *  - Code size is offered second and warns, because changing it restarts the transfer; frame rate
 *    is free and often enough on its own. The order is the advice.
 */

import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { OPTICAL_MAX_DISPLAY_FPS } from '@/utils/optical/bench';
import { OPTICAL_PRESETS, type OpticalPresetId } from '@/utils/optical/presets';

/** Sparsest first, matching OPTICAL_PRESETS, so "−" always means "easier to scan". */
const PRESET_IDS = OPTICAL_PRESETS.map((preset) => preset.id);

interface OpticalQualityControlsProps {
  presetId: OpticalPresetId;
  fps: number;
  onPresetChange: (presetId: OpticalPresetId) => void;
  onFpsChange: (fps: number) => void;
  /** Shown alongside the density row so the cost of a change is visible before making it. */
  estimatedSeconds?: number;
}

export function OpticalQualityControls({
  presetId,
  fps,
  onPresetChange,
  onFpsChange,
  estimatedSeconds,
}: OpticalQualityControlsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const presetIndex = Math.max(0, PRESET_IDS.indexOf(presetId));
  const stepPreset = (delta: number) => {
    const next = PRESET_IDS[presetIndex + delta];
    if (next) {
      onPresetChange(next);
    }
  };

  return (
    <View className="w-full gap-2">
      <Pressable
        className="flex-row items-center justify-center gap-2 py-2"
        onPress={() => setExpanded((previous) => !previous)}
      >
        <Text className="text-sm font-semibold" style={{ color: theme.colors.accent.primary }}>
          {t('opticalTransfer.quality.trigger')}
        </Text>
        {expanded ? (
          <ChevronUp color={theme.colors.accent.primary} size={theme.iconSize.sm} />
        ) : (
          <ChevronDown color={theme.colors.accent.primary} size={theme.iconSize.sm} />
        )}
      </Pressable>

      {expanded ? (
        <View
          className="gap-4 rounded-xl p-4"
          style={{ backgroundColor: theme.colors.background.card }}
        >
          {/* Free to change, so it is offered first. */}
          <StepperRow
            canDecrease={fps > 1}
            canIncrease={fps < OPTICAL_MAX_DISPLAY_FPS}
            hint={t('opticalTransfer.quality.speedHint')}
            label={t('opticalTransfer.quality.speed')}
            onDecrease={() => onFpsChange(Math.max(1, fps - 1))}
            onIncrease={() => onFpsChange(Math.min(OPTICAL_MAX_DISPLAY_FPS, fps + 1))}
            value={t('opticalTransfer.quality.speedValue', { fps })}
          />

          <StepperRow
            canDecrease={presetIndex > 0}
            canIncrease={presetIndex < PRESET_IDS.length - 1}
            hint={
              estimatedSeconds
                ? t('opticalTransfer.quality.sizeHintWithTime', { seconds: estimatedSeconds })
                : t('opticalTransfer.quality.sizeHint')
            }
            label={t('opticalTransfer.quality.size')}
            // "−" moves toward sparser, which is what someone with a struggling camera wants.
            onDecrease={() => stepPreset(-1)}
            onIncrease={() => stepPreset(1)}
            value={t(`opticalTransfer.quality.density.${presetId}`)}
          />

          <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            {t('opticalTransfer.quality.sizeRestartsNote')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function StepperRow({
  label,
  value,
  hint,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  hint: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm font-semibold text-text-primary">{label}</Text>

        <View className="flex-row items-center gap-3">
          <StepperButton disabled={!canDecrease} icon="minus" onPress={onDecrease} />
          <Text
            className="text-center text-sm font-semibold text-text-primary"
            style={{ minWidth: theme.size['20'] }}
          >
            {value}
          </Text>
          <StepperButton disabled={!canIncrease} icon="plus" onPress={onIncrease} />
        </View>
      </View>
      <Text className="text-xs text-text-tertiary">{hint}</Text>
    </View>
  );
}

function StepperButton({
  icon,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = disabled ? theme.colors.text.tertiary : theme.colors.text.primary;
  const Icon = icon === 'minus' ? Minus : Plus;

  return (
    <Pressable
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background.cardElevated,
        borderRadius: theme.borderRadius.sm,
        height: theme.size['10'],
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        width: theme.size['10'],
      }}
    >
      <Icon color={color} size={theme.iconSize.md} />
    </Pressable>
  );
}
