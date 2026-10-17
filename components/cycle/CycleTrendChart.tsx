import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import type { TrendPoint } from '@/utils/cycle/historyAnalysis';

/** Separate dots preserve missing days instead of drawing invented measurements between them. */
export function CycleTrendChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!points.length) {
    return null;
  }

  const shown = points.slice(-90);
  const first = shown[0].date;
  const span = Math.max(1, shown[shown.length - 1].date - first);
  const low = Math.min(...shown.map((p) => p.value));
  const high = Math.max(...shown.map((p) => p.value));
  const range = Math.max(1, high - low);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('cycle.complete.chartDescription', { metric: label })}
    >
      <Svg width="100%" height={140} viewBox="0 0 320 140" accessible={false}>
        <Line x1={16} y1={120} x2={304} y2={120} stroke={theme.colors.text.tertiary} />
        {shown.map((point, i) => (
          <Circle
            key={`${point.date}:${i}`}
            cx={16 + (288 * (point.date - first)) / span}
            cy={110 - (90 * (point.value - low)) / range}
            r={4}
            fill={theme.colors.accent.primary}
          />
        ))}
      </Svg>
    </View>
  );
}
