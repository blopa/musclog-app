import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { MuscleGroupSets, WorkoutVolumePoint } from '@/database/services/ProgressService';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { getXAxisLabels } from '@/utils/chartUtils';
import { getMuscleGroupTranslationKey } from '@/utils/exerciseTranslation';

import { ProgressChartSection } from './ProgressChartSection';

interface WorkoutChartsProps {
  workoutVolumeHistory: WorkoutVolumePoint[];
  muscleGroupSets: MuscleGroupSets[];
}

export function WorkoutCharts({ workoutVolumeHistory, muscleGroupSets }: WorkoutChartsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dateFnsLocale = useDateFnsLocale();
  const { formatInteger } = useFormatAppNumber();

  return (
    <View>
      {workoutVolumeHistory.length >= 2 ? (
        <ProgressChartSection
          title={t('progress.workoutVolume')}
          subtitle={t('progress.workoutVolumeSubtitle')}
        >
          <LineChart
            data={workoutVolumeHistory.map((p) => ({ x: p.date, y: p.volume }))}
            height={200}
            lineColor={theme.colors.status.violet500}
            areaColor={theme.colors.status.purple10}
            xDomain={[
              workoutVolumeHistory[0].date,
              workoutVolumeHistory[workoutVolumeHistory.length - 1].date,
            ]}
            yDomain={[
              Math.min(...workoutVolumeHistory.map((p) => p.volume)) * 0.5,
              Math.max(...workoutVolumeHistory.map((p) => p.volume)) * 1.2,
            ]}
            tooltipFormatter={(p) => formatInteger(Math.round(p.y))}
            xAxisLabels={getXAxisLabels(
              workoutVolumeHistory.map((p) => ({ x: p.date })),
              undefined,
              dateFnsLocale
            )}
          />
        </ProgressChartSection>
      ) : null}

      {muscleGroupSets.length > 0 ? (
        <ProgressChartSection
          title={t('progress.setsPerMuscleGroup')}
          subtitle={t('progress.setsPerMuscleGroupSubtitle')}
        >
          <BarChart
            data={muscleGroupSets.map((m, i) => ({ x: i, y: m.sets }))}
            height={200}
            barColor={theme.colors.status.pink500}
            xAxisLabels={getXAxisLabels(
              muscleGroupSets.map((m, i) => ({ x: i })),
              (x) => t(getMuscleGroupTranslationKey(muscleGroupSets[x].muscleGroup))
            )}
            tooltipFormatter={(p) => {
              const translatedMuscleGroup = t(
                getMuscleGroupTranslationKey(muscleGroupSets[p.x].muscleGroup)
              );
              return t('common.labelColonValue', {
                label: translatedMuscleGroup,
                value: formatInteger(Math.round(p.y)),
              });
            }}
          />
        </ProgressChartSection>
      ) : null}
    </View>
  );
}
