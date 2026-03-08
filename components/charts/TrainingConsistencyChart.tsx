import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

const DEFAULT_NEON = '#00FFA2';
const DEFAULT_BORDER = '#1C2623';

/**
 * Cell intensity: 0 = empty (border color), 1–5 = neon at 20%, 40%, 60%, 80%, 100%.
 * Value 5 can optionally show a glow (high PR).
 */
export type TrainingConsistencyChartProps = {
  /** Chart title */
  title?: string;
  /** Subtitle (e.g. "Last 12 Weeks") */
  subtitle?: string;
  /** Percentage shown top-right (e.g. 84) */
  percentage?: number;
  /** Label below percentage (e.g. "GOAL REACHED") */
  percentageLabel?: string;
  /**
   * Flat array of cell intensities, 0–5.
   * Grid is filled column-by-column with rowsPerColumn rows per column.
   * Length should be columns * rowsPerColumn (e.g. 12 * 7 = 84).
   */
  data: number[];
  /** Number of rows per column (e.g. 7 for days per week) (default: 7) */
  rowsPerColumn?: number;
  /** Number of columns (e.g. 12 for 12 weeks) (default: 12) */
  columns?: number;
  /** Accent color for filled cells (default: mint green) */
  accentColor?: string;
  /** Color for empty/low cells (default: theme border) */
  emptyColor?: string;
  /** Whether to show glow on max-intensity cells (default: true) */
  showGlowOnMax?: boolean;
  /** Height of the grid area in pixels (default: 128) */
  gridHeight?: number;
  /** Gap between cells (default: 6) */
  gap?: number;
  /** Custom className */
  className?: string;
};

const OPACITIES: Record<number, number> = {
  0: 0,
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1,
};

export function TrainingConsistencyChart({
  title,
  subtitle,
  percentage,
  percentageLabel = 'GOAL REACHED',
  data,
  rowsPerColumn = 7,
  columns = 12,
  accentColor = DEFAULT_NEON,
  emptyColor,
  showGlowOnMax = true,
  gridHeight = 128,
  gap = 6,
  className,
}: TrainingConsistencyChartProps) {
  const theme = useTheme();
  const borderColor = emptyColor ?? theme.colors?.border?.light ?? DEFAULT_BORDER;
  const mutedColor = theme.colors?.text?.tertiary ?? '#7E8A87';
  const textPrimary = theme.colors?.text?.primary ?? '#ffffff';

  const totalCells = rowsPerColumn * columns;
  const cells = data.slice(0, totalCells);
  const rowCount = rowsPerColumn;
  const colCount = Math.ceil(cells.length / rowCount) || columns;

  return (
    <View className={className}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between" style={{ marginBottom: 24 }}>
        <View>
          {title != null ? (
            <Text
              className="text-lg font-semibold text-text-primary"
              style={{ fontSize: theme.typography?.fontSize?.lg ?? 18, color: textPrimary }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="mt-0.5 text-xs uppercase tracking-widest"
              style={{
                fontSize: theme.typography?.fontSize?.xs ?? 12,
                color: mutedColor,
                marginTop: 2,
                letterSpacing: 4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {percentage != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontSize: theme.typography?.fontSize?.xl ?? 20,
                fontWeight: '700',
                color: accentColor,
              }}
            >
              {percentage}%
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: mutedColor,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              {percentageLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Grid: flow by column, rowsPerColumn rows */}
      <View
        style={{
          height: gridHeight,
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap,
          alignContent: 'flex-start',
          alignItems: 'flex-start',
        }}
      >
        {Array.from({ length: colCount }, (_, colIndex) => (
          <View
            key={colIndex}
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'column',
              gap,
              justifyContent: 'space-between',
            }}
          >
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const flatIndex = colIndex * rowCount + rowIndex;
              const value = cells[flatIndex] ?? 0;
              const intensity = Math.max(0, Math.min(5, Math.floor(value)));
              const opacity = OPACITIES[intensity] ?? 0;
              const isEmpty = intensity === 0;
              const isMax = intensity === 5;

              return (
                <View
                  key={rowIndex}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 4,
                    backgroundColor: isEmpty ? borderColor : accentColor,
                    opacity: isEmpty ? 1 : opacity,
                    ...(showGlowOnMax && isMax && !isEmpty
                      ? {
                          shadowColor: accentColor,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 4,
                        }
                      : {}),
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View
        className="mt-4 flex-row items-center justify-between"
        style={{
          marginTop: 16,
          paddingHorizontal: 0,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            color: mutedColor,
            fontWeight: '500',
          }}
        >
          Less intense
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: borderColor,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
              opacity: 0.3,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            color: mutedColor,
            fontWeight: '500',
          }}
        >
          High PR
        </Text>
      </View>
    </View>
  );
}
