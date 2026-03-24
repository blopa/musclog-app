import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { theme as appTheme } from '../../theme';

export type CycleSegmentConfig = {
  /** Width ratio 0–1 (e.g. 0.2 for 20%) */
  width: number;
  /** Segment color (e.g. '#BF5AF2') */
  color: string;
  /** Label below (e.g. 'Menstrual') */
  label: string;
  /** Optional opacity 0–1 (default: 1) */
  opacity?: number;
};

export type CycleTrackingChartProps = {
  /** Card title (e.g. 'Cycle Tracking') */
  title?: string;
  /** Current phase label (e.g. 'Follicular Phase • Day 12') */
  phaseLabel?: string;
  /** Optional badge: { title: 'Conception Chance', value: 'Peak Window' } */
  badge?: { title: string; value: string };
  /** Segments left to right (e.g. Menstrual, Follicular, Ovulatory, Luteal) */
  segments: CycleSegmentConfig[];
  /** Position of TODAY marker, 0–1 (e.g. 0.42 for 42%) */
  todayPosition: number;
  /** Height of the bar in px (default: 24) */
  barHeight?: number;
  /** Whether to show pulsing dot next to phase label (default: true) */
  showPhasePulse?: boolean;
  className?: string;
};

const DEFAULT_SEGMENTS: CycleSegmentConfig[] = [
  // TODO: use i18n for the labels
  { width: 0.2, color: appTheme.colors.status.purple, label: 'Menstrual', opacity: 0.6 },
  { width: 0.3, color: appTheme.colors.status.emeraldLight, label: 'Follicular', opacity: 0.4 },
  { width: 0.15, color: appTheme.colors.status.warning, label: 'Ovulatory', opacity: 0.7 },
  { width: 0.35, color: appTheme.colors.status.teal400, label: 'Luteal', opacity: 0.4 },
];

export function CycleTrackingChart({
  title,
  phaseLabel,
  badge,
  segments = DEFAULT_SEGMENTS,
  todayPosition = 0.42,
  barHeight = 24,
  showPhasePulse = true,
  className,
}: CycleTrackingChartProps) {
  const theme = useTheme();

  return (
    <View className={className}>
      <View className="mb-10 flex-col md:flex-row md:items-center md:justify-between">
        <View>
          {title != null ? (
            <Text
              className="text-2xl font-semibold text-text-primary"
              style={{ fontSize: theme.typography.fontSize['2xl'] ?? 24 }}
            >
              {title}
            </Text>
          ) : null}
          {phaseLabel != null ? (
            <View className="mt-1 flex-row items-center gap-2">
              {showPhasePulse ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.accent.primary,
                    opacity: 0.9,
                  }}
                />
              ) : null}
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  fontWeight: '500',
                  color: theme.colors.accent.primary,
                }}
              >
                {phaseLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {badge != null ? (
          <View
            className="mt-4 rounded-2xl border border-border-default px-5 py-2 md:mt-0"
            style={{
              backgroundColor: theme.colors.background.primary,
              borderColor: theme.colors.border.light,
            }}
          >
            <Text
              className="text-[10px] uppercase tracking-tighter text-text-tertiary"
              style={{ fontSize: 10 }}
            >
              {badge.title}
            </Text>
            <Text
              className="font-bold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.sm, fontWeight: '700' }}
            >
              {badge.value}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        className="relative mb-4 w-full rounded-full border border-border-default p-1"
        style={{
          height: barHeight,
          backgroundColor: theme.colors.background.primary,
          borderColor: theme.colors.border.light,
        }}
      >
        <View className="h-full w-full flex-row overflow-hidden rounded-full">
          {segments.map((seg, i) => (
            <View
              key={seg.label}
              style={{
                width: `${seg.width * 100}%`,
                height: '100%',
                backgroundColor: seg.color,
                opacity: seg.opacity ?? 1,
                borderTopLeftRadius: i === 0 ? barHeight / 2 : 0,
                borderBottomLeftRadius: i === 0 ? barHeight / 2 : 0,
                borderTopRightRadius: i === segments.length - 1 ? barHeight / 2 : 0,
                borderBottomRightRadius: i === segments.length - 1 ? barHeight / 2 : 0,
              }}
            />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${todayPosition * 100}%`,
            top: -8,
            width: 6,
            height: barHeight + 16,
            marginLeft: -3,
            backgroundColor: theme.colors.text.white,
            borderRadius: 3,
            shadowColor: theme.colors.text.white,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
            elevation: 8,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -36,
              left: '50%',
              marginLeft: -28,
              width: 56,
              backgroundColor: theme.colors.text.white,
              borderRadius: theme.borderRadius.sm,
              paddingVertical: 4,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: theme.colors.background.primary,
              }}
            >
              TODAY
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row justify-between px-1">
        {segments.map((seg) => (
          <Text
            key={seg.label}
            style={{
              fontSize: 11,
              fontWeight: '700',
              textTransform: 'uppercase',
              color: seg.color,
            }}
          >
            {seg.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
