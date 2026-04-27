import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

export type ActivityRingConfig = {
  /** Progress 0–1 (e.g. 0.8 for 80%) */
  progress: number;
  /** Stroke color (e.g. '#00FFA2') */
  color: string;
  /** Legend label (e.g. 'Move') */
  label: string;
  /** Legend value (e.g. '80%') */
  value: string;
};

export type ActivityRingsChartProps = {
  /** Card title (e.g. 'Daily Goals') */
  title?: string;
  /** Card subtitle (e.g. 'Activity Rings') */
  subtitle?: string;
  /** Up to 3 rings, outer to inner (default: Move 80%, Steps 65%, Rest 45%) */
  rings?: ActivityRingConfig[];
  /** Center value (e.g. '82') */
  centerValue?: string;
  /** Center label (e.g. 'Score') */
  centerLabel?: string;
  /** Size of the rings container in px (default: 224) */
  size?: number;
  /** Border color for track (default: theme border) */
  trackColor?: string;
  /** Stroke width in viewBox units (default: 8) */
  strokeWidth?: number;
  className?: string;
};

const VIEWBOX_SIZE = 100;
const RADII = [40, 30, 20]; // outer to inner

export function ActivityRingsChart({
  title,
  subtitle,
  rings,
  centerValue = '82',
  centerLabel,
  size = 224,
  trackColor,
  strokeWidth = 8,
  className,
}: ActivityRingsChartProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const defaultRings = useMemo<ActivityRingConfig[]>(
    () => [
      {
        progress: 0.8,
        color: theme.colors.status.emeraldLight,
        label: t('home.activityRings.move'),
        value: '80%',
      },
      {
        progress: 0.65,
        color: theme.colors.status.teal400,
        label: t('home.activityRings.steps'),
        value: '65%',
      },
      {
        progress: 0.45,
        color: theme.colors.status.purple,
        label: t('home.activityRings.rest'),
        value: '45%',
      },
    ],
    [theme, t]
  );
  const track = trackColor ?? theme.colors.border.light;
  const displayRings = (rings ?? defaultRings).slice(0, 3);
  const resolvedCenterLabel = centerLabel ?? t('home.activityRings.score');

  return (
    <View className={className} style={{ alignItems: 'center' }}>
      {title != null || subtitle != null ? (
        <View className="mb-6 w-full">
          {title != null ? (
            <Text
              className="text-text-primary text-xl font-semibold"
              style={{ fontSize: theme.typography.fontSize.xl }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="text-text-tertiary mt-1 text-xs tracking-widest uppercase"
              style={{ marginTop: 4, letterSpacing: 4 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
        >
          {RADII.map((r, i) => (
            <Circle
              key={`track-${i}`}
              cx={VIEWBOX_SIZE / 2}
              cy={VIEWBOX_SIZE / 2}
              r={r}
              fill="none"
              stroke={track}
              strokeWidth={strokeWidth}
            />
          ))}
          {displayRings.map((ring, i) => {
            const r = RADII[i];
            const circumference = 2 * Math.PI * r;
            const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, ring.progress)));
            return (
              <Circle
                key={`ring-${i}`}
                cx={VIEWBOX_SIZE / 2}
                cy={VIEWBOX_SIZE / 2}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            );
          })}
        </Svg>
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize['3xl'] ?? 30,
              fontWeight: '700',
              color: theme.colors.text.primary,
              lineHeight: theme.typography.fontSize['3xl'] ?? 30,
            }}
          >
            {centerValue}
          </Text>
          <Text
            className="text-text-tertiary mt-1 text-[10px] font-bold uppercase"
            style={{ marginTop: 4, fontSize: 10 }}
          >
            {resolvedCenterLabel}
          </Text>
        </View>
      </View>

      {displayRings.length > 0 ? (
        <View
          className="border-border-default mt-8 w-full flex-row border-t pt-6"
          style={{
            borderTopColor: theme.colors.border.light,
            borderTopWidth: 1,
          }}
        >
          {displayRings.map((ring, i) => (
            <View
              key={ring.label}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderRightWidth: i === displayRings.length - 1 ? 0 : 1,
                borderColor: theme.colors.border.light,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: '700',
                  color: ring.color,
                }}
              >
                {ring.value}
              </Text>
              <Text
                className="text-text-tertiary text-[9px] uppercase"
                style={{ fontSize: 9, marginTop: 2 }}
              >
                {ring.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
