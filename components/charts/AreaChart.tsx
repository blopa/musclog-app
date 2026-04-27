import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Area, CartesianChart, Line, Scatter } from 'victory-native';

import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { XAxisLabel } from '@/utils/chartUtils';

/** Map chart points to victory-native PointsArray (includes xValue, yValue) */
function toPointsArray(
  pts: { x: number; y: number }[]
): { x: number; y: number; xValue: number; yValue: number }[] {
  return pts.map((p) => ({ x: p.x, y: p.y, xValue: p.x, yValue: p.y }));
}

/** One data point: x plus one value per series key (e.g. protein, fats, carbs) */
export type AreaChartDatum = { x: number; [key: string]: number };

/** Config for each series: key in data, label in legend, color, optional legend value (e.g. "42%") */
export type AreaChartSeriesConfig = {
  key: string;
  label: string;
  color: string;
  /** Optional value shown in legend (e.g. "42%") */
  value?: string;
};

export type AreaChartProps = {
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Data points; each has x and one numeric value per series key */
  data: AreaChartDatum[];
  /** Series definitions (order = draw order bottom to top) */
  series: AreaChartSeriesConfig[];
  /** Height of the chart in pixels (default: 256) */
  height?: number;
  /** X domain [min, max] (default: from data) */
  xDomain?: [number, number];
  /** Y domain [min, max] (default: [0, 100]) */
  yDomain?: [number, number];
  /** X-axis labels below the chart */
  xAxisLabels?: XAxisLabel[];
  /** Y-axis labels on the left */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Peak marker: which series and which point index; optional label (e.g. "Peak") */
  peak?: { seriesKey: string; pointIndex: number; label?: string };
  /** Whether to show grid lines (default: true) */
  showGridLines?: boolean;
  /** Grid line color (default: theme border) */
  gridLineColor?: string;
  /** Area fill opacity 0–1 (default: 0.35) */
  areaOpacity?: number;
  /** Custom margin top (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X labels (default: 16) */
  marginBottom?: number;
  /** Custom className */
  className?: string;
  /** Enable touch interaction to show a tooltip on press (default: true) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y values) */
  tooltipFormatter?: (point: AreaChartDatum) => string;
};

const PEAK_MARKER_R = 4;
const PEAK_LABEL_WIDTH = 40;
const PEAK_LABEL_HEIGHT = 24;

const TOOLTIP_WIDTH = 120;
const TOOLTIP_HEIGHT = 56;

export function AreaChart({
  title,
  subtitle,
  data,
  series,
  height = 256,
  xDomain,
  yDomain = [0, 100],
  xAxisLabels,
  yAxisLabels,
  peak,
  showGridLines = true,
  gridLineColor,
  areaOpacity = 0.35,
  marginTop = 8,
  marginBottom = 8,
  className,
  interactive = true,
  tooltipFormatter,
}: AreaChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const containerWidthRef = useRef(0);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const { formatRoundedDecimal } = useFormatAppNumber();

  if (data.length === 0 || series.length === 0) {
    return null;
  }

  const yKeys = series.map((s) => s.key);
  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const lineColorResolved = gridLineColor ?? theme.colors.border.light;

  /** Hex color with alpha for area fill */
  const withAlpha = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const chartData = data as Record<string, number>[];

  const peakSeries = peak ? series.find((s) => s.key === peak.seriesKey) : null;
  const peakDataX = peak && data[peak.pointIndex] != null ? data[peak.pointIndex].x : null;

  const handleTouchAt = (touchX: number) => {
    const w = containerWidthRef.current;
    if (w === 0) {
      return;
    }
    const domainX = xDomainFinal[0] + (touchX / w) * (xDomainFinal[1] - xDomainFinal[0]);
    const nearest = data.reduce((prev, curr) =>
      Math.abs(curr.x - domainX) < Math.abs(prev.x - domainX) ? curr : prev
    );
    const label = tooltipFormatter
      ? tooltipFormatter(nearest)
      : series
          .map((s) =>
            t('common.labelColonValue', {
              label: s.label,
              value: formatRoundedDecimal(nearest[s.key] ?? 0, 1),
            })
          )
          .join('\n');
    notifyChartActive(chartId);
    setActiveLabel(label);
  };

  return (
    <View className={className} style={{ marginTop }}>
      {title != null || subtitle != null ? (
        <View style={{ marginBottom: 0 }}>
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
              className="text-text-secondary mt-0.5 text-sm"
              style={{ fontSize: theme.typography.fontSize.sm, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height, position: 'relative' }}>
        {/* Y-axis labels */}
        {yAxisLabels != null && yAxisLabels.length > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: marginBottom + 4,
              width: 20,
              justifyContent: 'space-between',
              zIndex: 2,
            }}
          >
            {yAxisLabels.map(({ label }, i) => (
              <Text
                key={`${label}-${i}`}
                style={{
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: '600',
                  color: theme.colors.text.tertiary,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Chart area: symmetric horizontal padding */}
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 0,
            bottom: marginBottom + 4,
          }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setChartWidth(w);
            containerWidthRef.current = w;
          }}
        >
          <CartesianChart
            data={chartData}
            xKey="x"
            yKeys={yKeys}
            domain={{ x: xDomainFinal, y: yDomain }}
            padding={0}
            domainPadding={{ left: 0, right: 0, top: 10, bottom: 0 }}
            axisOptions={{
              lineColor: showGridLines ? lineColorResolved : 'transparent',
              labelColor: 'transparent',
            }}
          >
            {({ points, chartBounds }) => (
              <>
                {series.map((s, idx) => {
                  const pts = (points as Record<string, { x: number; y: number }[]>)[s.key];
                  if (!pts || pts.length === 0) {
                    return null;
                  }
                  const fillColor = withAlpha(s.color, areaOpacity);
                  const pointsArray = toPointsArray(pts);
                  return (
                    <React.Fragment key={s.key}>
                      <Area
                        points={pointsArray}
                        y0={chartBounds.bottom}
                        curveType="monotoneX"
                        color={fillColor}
                      />
                      <Line
                        points={pointsArray}
                        curveType="monotoneX"
                        color={s.color}
                        strokeWidth={idx === series.length - 1 ? 2.5 : 2}
                        strokeCap="round"
                      />
                    </React.Fragment>
                  );
                })}
                {peak != null && peakSeries != null
                  ? (() => {
                      const pts = (points as Record<string, { x: number; y: number }[]>)[
                        peak!.seriesKey
                      ];
                      const peakPixel = pts?.[peak!.pointIndex];
                      return peakPixel ? (
                        <Scatter
                          points={toPointsArray([peakPixel])}
                          radius={PEAK_MARKER_R}
                          color={theme.colors.text.white}
                          style="fill"
                        />
                      ) : null;
                    })()
                  : null}
              </>
            )}
          </CartesianChart>
        </View>

        {interactive ? (
          <View
            style={{ position: 'absolute', top: 0, left: 20, right: 20, bottom: marginBottom + 4 }}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderRelease={(e) => handleTouchAt(e.nativeEvent.locationX)}
          />
        ) : null}

        {interactive && activeLabel ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              ...(tooltipPosition === 'left' ? { left: 6 } : { right: 6 }),
              minWidth: TOOLTIP_WIDTH,
              minHeight: TOOLTIP_HEIGHT,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.xs,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.sm,
              shadowColor: theme.colors.text.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
              zIndex: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {activeLabel}
            </Text>
          </View>
        ) : null}

        {/* Peak label tooltip - position from chart width (updated in onLayout) */}
        {peak != null && peak.label != null && peakDataX != null && chartWidth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:
                20 +
                ((peakDataX - xDomainFinal[0]) / (xDomainFinal[1] - xDomainFinal[0] || 1)) *
                  chartWidth -
                PEAK_LABEL_WIDTH / 2,
              top: 0,
              width: PEAK_LABEL_WIDTH,
              height: PEAK_LABEL_HEIGHT,
              backgroundColor: theme.colors.text.white,
              borderRadius: theme.borderRadius.xs,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.colors.text.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
              zIndex: 10,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: theme.colors.background.primary,
              }}
            >
              {peak.label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* X-axis labels */}
      {xAxisLabels != null && xAxisLabels.length > 0 ? (
        <View
          style={{
            position: 'relative',
            marginTop: 4,
            paddingLeft: 20,
            paddingRight: 20,
            height: 20,
            width: '100%',
          }}
        >
          {xAxisLabels.map((label, index) => (
            <View
              key={`${label.label}-${index}`}
              style={{
                position: 'absolute',
                left: 20 + (label.positionPercent / 100) * chartWidth,
                width: 40,
                marginLeft: -20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: theme.colors.text.tertiary,
                  textAlign: 'center',
                  marginLeft:
                    label.positionPercent === 0 ? 20 : label.positionPercent === 100 ? -20 : 0,
                }}
                numberOfLines={1}
              >
                {label.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Legend */}
      {series.length > 0 ? (
        <View
          className="border-border-default flex-row justify-around border-t"
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopColor: theme.colors.border.light,
            borderTopWidth: 1,
          }}
        >
          {series.map((s, idx) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftWidth: idx === 0 ? 0 : 1,
                borderRightWidth: idx === series.length - 1 ? 0 : 1,
                borderColor: theme.colors.border.light,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: s.color,
                  }}
                />
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.text.tertiary,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.label}
                </Text>
              </View>
              {s.value != null ? (
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                    color: theme.colors.text.primary,
                  }}
                >
                  {s.value}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
