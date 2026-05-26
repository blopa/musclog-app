import { Download, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Platform, Text, View } from 'react-native';

import { LineChart, type LineChartDataPoint } from '@/components/charts/LineChart';
import { MenuButton } from '@/components/theme/MenuButton';
import { WorkoutMusclesDetails } from '@/components/WorkoutMusclesDetails';
import { useChartCapture } from '@/hooks/useChartCapture';
import { useTheme } from '@/hooks/useTheme';
import { type BleWorkoutSample, readBleDataPointsFile } from '@/utils/bleWorkoutDataStorage';

import { FullScreenModal } from './FullScreenModal';

export type ExerciseSetRef = { id: string; setNumber: number };

function samplesToChartPoints(samples: BleWorkoutSample[]): LineChartDataPoint[] {
  if (!samples.length) {
    return [];
  }
  const t0 = samples[0].timestamp;
  return samples.map((s) => ({
    x: (s.timestamp - t0) / 1000,
    y: Math.sqrt(s.angle.x ** 2 + s.angle.y ** 2 + s.angle.z ** 2),
  }));
}

const emptyChartMap = new Map<string, LineChartDataPoint[]>();

// Returns null while loading, emptyChartMap when there are no sets, or
// the populated Map once all files resolve. Loading state is derived from
// a key comparison to avoid synchronous setState inside the effect body.
function useSetRepCharts(sets: ExerciseSetRef[]): Map<string, LineChartDataPoint[]> | null {
  const [loadedKey, setLoadedKey] = useState('');
  const [charts, setCharts] = useState<Map<string, LineChartDataPoint[]>>(new Map());

  useEffect(() => {
    const key = sets.map((s) => s.id).join(',');
    if (!key) {
      return;
    }

    let cancelled = false;
    Promise.all(
      sets.map(async (set) => {
        const samples = await readBleDataPointsFile(set.id);
        return { id: set.id, points: samples ? samplesToChartPoints(samples) : [] };
      })
    ).then((results) => {
      if (!cancelled) {
        setCharts(new Map(results.map((r) => [r.id, r.points])));
        setLoadedKey(key);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sets]);

  if (!sets.length) {
    return emptyChartMap;
  }

  const setsKey = sets.map((s) => s.id).join(',');
  return loadedKey === setsKey ? charts : null;
}

type WorkoutMusclesModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  muscleGroups: (string | null | undefined)[];
  exerciseSets?: ExerciseSetRef[];
};

export function WorkoutMusclesModal({
  visible,
  onClose,
  title,
  muscleGroups,
  exerciseSets = [],
}: WorkoutMusclesModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { captureRef, isCapturing, captureAndShare } = useChartCapture();
  const charts = useSetRepCharts(exerciseSets);

  const chartWidth = Dimensions.get('window').width - 48;
  const setsWithData = exerciseSets.filter((s) => (charts?.get(s.id)?.length ?? 0) > 0);
  const modalTitle = title ?? t('workoutDetail.musclesWorked');

  function renderRepContent() {
    if (charts === null) {
      return <ActivityIndicator color={theme.colors.accent.primary} style={{ marginTop: 16 }} />;
    }

    if (!setsWithData.length) {
      return null;
    }

    return (
      <>
        <Text
          style={{
            color: theme.colors.text.tertiary,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          {t('workoutDetail.repMotion')}
        </Text>
        {setsWithData.map((set) => {
          const points = charts.get(set.id)!;
          const maxTime = points[points.length - 1]?.x ?? 1;
          const maxY = Math.max(...points.map((p) => p.y));
          return (
            <View
              key={set.id}
              style={{
                backgroundColor: theme.colors.background.card,
                borderRadius: theme.borderRadius.xl,
                padding: theme.spacing.padding.base,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text.primary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 8,
                }}
              >
                {t('workoutDetail.setLabel', { index: set.setNumber })}
              </Text>
              <LineChart
                data={points}
                height={100}
                chartWidth={chartWidth}
                chartHeight={80}
                xDomain={[0, maxTime]}
                yDomain={[0, maxY * 1.15]}
                lineWidth={2}
                showLastPoint={false}
                showGridLines={false}
                marginTop={4}
                marginBottom={4}
                interactive={false}
              />
            </View>
          );
        })}
      </>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={modalTitle}
      scrollable={exerciseSets.length > 0}
      headerRight={
        !isCapturing ? (
          <MenuButton
            icon={Platform.OS === 'web' ? Download : Share2}
            size="sm"
            color={theme.colors.text.tertiary}
            onPress={() => captureAndShare(modalTitle)}
          />
        ) : null
      }
    >
      <WorkoutMusclesDetails muscleGroups={muscleGroups} captureRef={captureRef} />
      {exerciseSets.length > 0 ? (
        <View
          style={{
            padding: theme.spacing.padding.base,
            gap: theme.spacing.gap.md,
          }}
        >
          {renderRepContent()}
        </View>
      ) : null}
    </FullScreenModal>
  );
}
