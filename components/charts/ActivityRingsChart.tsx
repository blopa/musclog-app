import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../../hooks/useTheme';
import { theme as appTheme } from '../../theme';

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

const DEFAULT_RINGS: ActivityRingConfig[] = [
  // TODO: use i18n for the labels
  { progress: 0.8, color: appTheme.colors.status.emeraldLight, label: 'Move', value: '80%' },
  { progress: 0.65, color: appTheme.colors.status.teal400, label: 'Steps', value: '65%' },
  { progress: 0.45, color: appTheme.colors.status.purple, label: 'Rest', value: '45%' },
];

const VIEWBOX_SIZE = 100;
const RADII = [40, 30, 20]; // outer to inner

export function ActivityRingsChart({
  title,
  subtitle,
  rings = DEFAULT_RINGS,
  centerValue = '82',
  centerLabel = 'Score',
  size = 224,
  trackColor,
  strokeWidth = 8,
  className,
}: ActivityRingsChartProps) {
  const theme = useTheme();
  const track = trackColor ?? theme.colors.border.light;
  const displayRings = rings.slice(0, 3);

  return (
    <View className={className} style={{ alignItems: 'center' }}>
      {title != null || subtitle != null ? (
        <View className="mb-6 w-full">
          {title != null ? (
            <Text
              className="text-xl font-semibold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.xl }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="mt-1 text-xs uppercase tracking-widest text-text-tertiary"
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
            className="mt-1 text-[10px] font-bold uppercase text-text-tertiary"
            style={{ marginTop: 4, fontSize: 10 }}
          >
            {centerLabel}
          </Text>
        </View>
      </View>

      {displayRings.length > 0 ? (
        <View
          className="mt-8 w-full flex-row border-t border-border-default pt-6"
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
                className="text-[9px] uppercase text-text-tertiary"
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
