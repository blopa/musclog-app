import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Line, Polygon, Svg, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

export type SpiderChartProps = {
  /** Chart title */
  title?: string;
  /** Chart subtitle (e.g. "Weekly Analysis") */
  subtitle?: string;
  /** Axis labels (e.g. ["Strength", "Stamina", "Recovery", "Flexibility", "Speed"]) */
  axes: string[];
  /** Values per axis, 0–100 (same length as axes) */
  values: number[];
  /** Color for the data polygon (default: theme accent / mint) */
  dataColor?: string;
  /** Fill opacity for the data polygon (default: 0.15) */
  dataFillOpacity?: number;
  /** Optional center score (e.g. 88) */
  centerScore?: number;
  /** Label below center score (e.g. "PTS") */
  centerScoreLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  /** Primary focus label (e.g. "Power Output") */
  primaryFocus?: string;
  /** Area to improve label (e.g. "Flexibility") */
  areaToImprove?: string;
  /** Number of concentric grid levels (default: 4) */
  gridLevels?: number;
  /** Size of the SVG viewBox and container (default: 300) */
  size?: number;
  /** Custom className */
  className?: string;
};

/** Angle in degrees for vertex i (0 at top, then clockwise). */
function vertexAngle(i: number, count: number): number {
  return -90 + (i * 360) / count;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Vertex position: center (cx,cy), radius R, vertex index i, total count n. */
function vertex(cx: number, cy: number, R: number, i: number, n: number): { x: number; y: number } {
  const angle = degToRad(vertexAngle(i, n));
  return {
    x: cx + R * Math.cos(angle),
    y: cy + R * Math.sin(angle),
  };
}

/** Polygon points string for a regular polygon. */
function polygonPoints(cx: number, cy: number, R: number, n: number): string {
  return Array.from({ length: n }, (_, i) => vertex(cx, cy, R, i, n))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}

export function SpiderChart({
  title,
  subtitle,
  axes,
  values,
  dataColor,
  dataFillOpacity = 0.15,
  centerScore,
  centerScoreLabel,
  primaryLabel,
  secondaryLabel,
  primaryFocus,
  areaToImprove,
  gridLevels = 4,
  size = 300,
  className,
}: SpiderChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const DEFAULT_DATA_COLOR = theme.colors.status.emeraldLight;
  const DEFAULT_GRID_COLOR = theme.colors.border.dark;
  const n = Math.min(axes.length, values.length, 12);
  if (n === 0) {
    return null;
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.43; // ~130 for 300

  const gridColor = theme.colors?.border?.light ?? DEFAULT_GRID_COLOR;
  const mutedColor = theme.colors.text.tertiary;
  const textPrimary = theme.colors.text.primary;
  const dataColorResolved = dataColor ?? theme.colors?.accent?.primary ?? DEFAULT_DATA_COLOR;

  // Concentric grid polygons (outer to inner)
  const gridPolygons = Array.from({ length: gridLevels }, (_, level) => {
    const r = maxRadius * (1 - (level / gridLevels) * (1 - 0.05));
    return polygonPoints(cx, cy, r, n);
  });

  // Radial lines from center to each vertex
  const radialLines = Array.from({ length: n }, (_, i) => {
    const p = vertex(cx, cy, maxRadius, i, n);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // Data polygon: value 0-100 maps to radius 0 to maxRadius
  const dataPoints = Array.from({ length: n }, (_, i) => {
    const v = Math.max(0, Math.min(100, values[i] ?? 0));
    const r = (v / 100) * maxRadius;
    return vertex(cx, cy, r, i, n);
  });
  const dataPointsStr = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Label positions: slightly outside the outer polygon
  const labelRadius = maxRadius + size * 0.08;
  const labelPositions = Array.from({ length: n }, (_, i) => {
    const p = vertex(cx, cy, labelRadius, i, n);
    const angle = vertexAngle(i, n);
    // text-anchor: middle for top/bottom, start for right, end for left
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    if (angle > -30 && angle < 30) {
      anchor = 'start';
    } else if (angle > 150 || angle < -150) {
      anchor = 'end';
    }
    return { x: p.x, y: p.y, anchor };
  });

  return (
    <View className={className}>
      {title != null || subtitle != null ? (
        <View className="mb-4 items-center">
          {title != null ? (
            <Text
              className="text-xl font-semibold text-text-primary"
              style={{ fontSize: theme.typography?.fontSize?.xl ?? 20 }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="mt-1 text-sm uppercase tracking-widest text-text-tertiary"
              style={{
                fontSize: theme.typography?.fontSize?.sm ?? 14,
                color: mutedColor,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <Svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {/* Concentric grid polygons */}
          {gridPolygons.map((points, idx) => (
            <Polygon key={idx} points={points} fill="none" stroke={gridColor} strokeWidth={1} />
          ))}
          {/* Radial lines */}
          {radialLines.map((line, idx) => (
            <Line
              key={idx}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={gridColor}
              strokeWidth={1}
            />
          ))}
          {/* Data polygon */}
          <Polygon
            points={dataPointsStr}
            fill={dataColorResolved}
            fillOpacity={dataFillOpacity}
            stroke={dataColorResolved}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* Axis labels */}
          {labelPositions.map((pos, idx) => (
            <SvgText
              key={idx}
              x={pos.x}
              y={pos.y}
              fill={textPrimary}
              fontSize={11}
              fontWeight="600"
              textAnchor={pos.anchor}
            >
              {String(axes[idx]).toUpperCase()}
            </SvgText>
          ))}
        </Svg>

        {/* Center score overlay */}
        {centerScore != null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.background.primary,
                borderWidth: 1,
                borderColor: gridColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography?.fontSize?.lg ?? 18,
                  fontWeight: '700',
                  color: dataColorResolved,
                  lineHeight: theme.typography?.fontSize?.lg ?? 18,
                }}
              >
                {String(centerScore)}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  textTransform: 'uppercase',
                  color: mutedColor,
                  marginTop: 2,
                }}
              >
                {centerScoreLabel || t('spiderChart.defaultScoreLabel')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Footer: Primary Focus & Area to Improve */}
      {primaryFocus != null || areaToImprove != null ? (
        <View
          className="mt-8 flex-row gap-4 border-t border-border-default pt-6"
          style={{
            borderTopColor: gridColor,
            borderTopWidth: 1,
          }}
        >
          {primaryFocus != null ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.gap.md,
              }}
            >
              <View
                style={{
                  width: 4,
                  height: 32,
                  borderRadius: 2,
                  backgroundColor: dataColorResolved,
                }}
              />
              <View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    textTransform: 'uppercase',
                    color: mutedColor,
                  }}
                >
                  {primaryLabel || t('spiderChart.primaryFocus')}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                    color: textPrimary,
                  }}
                >
                  {primaryFocus}
                </Text>
              </View>
            </View>
          ) : null}
          {areaToImprove != null ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.gap.base,
              }}
            >
              <View
                style={{
                  width: 4,
                  height: 32,
                  borderRadius: 2,
                  backgroundColor: gridColor,
                }}
              />
              <View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    textTransform: 'uppercase',
                    color: mutedColor,
                  }}
                >
                  {secondaryLabel || t('spiderChart.areaToImprove')}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                    color: textPrimary,
                  }}
                >
                  {areaToImprove}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
