import LineChart from '@/components/Charts/LineChart';
import WeightAndFatMetricsInfo from '@/components/WeightAndFatMetricsInfo';
import { BULKING_GAIN_WEIGHT_RATIO, CUTTING_LOSS_WEIGHT_RATIO } from '@/constants/healthConnect';
import { EATING_PHASES } from '@/constants/nutrition';
import { IMPERIAL_SYSTEM, KILOGRAMS } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { getUser } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { EatingPhaseType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type WeightLineChartProps = {
    metricsAverages: any,
    showWeeklyAverages: boolean,
    weightData: any,
    weightLabels: string[],
    yAxisConfig: { axisMaximum: number, axisMinimum: number }
};

const WeightLineChart = ({
    metricsAverages,
    showWeeklyAverages,
    weightData,
    weightLabels,
    yAxisConfig,
}: WeightLineChartProps) => {
    const { t } = useTranslation();
    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [eatingPhase, setEatingPhase] = useState<EatingPhaseType | undefined>(undefined);

    useFocusEffect(useCallback(() => {
        const fetchUser = async () => {
            const user = await getUser();
            if (user?.metrics?.eatingPhase) {
                setEatingPhase(user.metrics.eatingPhase);
            }
        };

        fetchUser();
    }, []));

    const [idealWeightChangeRateMessage, currentWeightChangeRateMessage, totalBodyFatWeightMessage, bodyFatExamplesMessage, muscleFatChangeMessage] = useMemo(() => {
        if (metricsAverages) {
            const { averageFatPercentage, averageFatPercentageDifference, averageWeight, averageWeightDifference, fatPercentageDataPointsCount, weightDataPointsCount } = metricsAverages || {};
            const isMaintenance = eatingPhase === EATING_PHASES.MAINTENANCE || !eatingPhase;
            const isGainingWeight = averageWeightDifference > 0;
            const [min, max] = isGainingWeight ? BULKING_GAIN_WEIGHT_RATIO : CUTTING_LOSS_WEIGHT_RATIO;

            // Calculate lean body mass (LBM) using averages
            const leanBodyMassStart = averageWeight * (1 - averageFatPercentage / 100);
            const leanBodyMassEnd = (averageWeight + (averageWeightDifference * weightDataPointsCount)) * (1 - (averageFatPercentage + (averageFatPercentageDifference * fatPercentageDataPointsCount)) / 100);

            const fatMassStart = averageWeight * (averageFatPercentage / 100);
            const fatMassEnd = (averageWeight + (averageWeightDifference * weightDataPointsCount)) * ((averageFatPercentage + (averageFatPercentageDifference * fatPercentageDataPointsCount)) / 100);

            const muscleChange = leanBodyMassEnd - leanBodyMassStart;
            const fatChange = fatMassEnd - fatMassStart;

            // Determine which translation key to use
            let muscleFatChangeTranslationKey = 'your_muscle_fat_difference';
            if (muscleChange > 0 && fatChange < 0) {
                muscleFatChangeTranslationKey = 'you_have_gained_muscle_lost_fat';
            } else if (muscleChange > 0 && fatChange > 0) {
                muscleFatChangeTranslationKey = 'you_have_gained_muscle_gained_fat';
            } else if (muscleChange < 0 && fatChange < 0) {
                muscleFatChangeTranslationKey = 'you_have_lost_muscle_lost_fat';
            } else if (muscleChange < 0 && fatChange > 0) {
                muscleFatChangeTranslationKey = 'you_have_lost_muscle_gained_fat';
            }

            // Define target body fat percentages
            const targetBodyFatPercentages = [20, 15, 10, 5];

            // Calculate the total body weight for each target body fat percentage
            const bodyFatExamples = targetBodyFatPercentages.map((percentage) => {
                const totalWeightAtPercentage = safeToFixed(getDisplayFormattedWeight(leanBodyMassEnd / (1 - percentage / 100), KILOGRAMS, isImperial));
                return `${totalWeightAtPercentage}${weightUnit} (${percentage}%)`;
            }).join(', ');

            return [
                isMaintenance ? '' : t(isGainingWeight ? 'ideal_gaining_rate' : 'ideal_losing_rate', {
                    max: safeToFixed(getDisplayFormattedWeight(averageWeight * max, KILOGRAMS, isImperial)),
                    min: safeToFixed(getDisplayFormattedWeight(averageWeight * min, KILOGRAMS, isImperial)),
                    weightUnit,
                }),
                t(isGainingWeight ? 'you_re_currently_gaining_rate' : 'you_re_currently_losing_rate', {
                    weight: safeToFixed(getDisplayFormattedWeight(Math.abs(averageWeightDifference), KILOGRAMS, isImperial)),
                    weightUnit,
                }),
                t('you_have_value_body_fat', {
                    value: getDisplayFormattedWeight(averageWeight * averageFatPercentage / 100, KILOGRAMS, isImperial),
                    weightUnit,
                }),
                t('example_body_fat_weights', { examples: bodyFatExamples }),
                t(muscleFatChangeTranslationKey, {
                    fat: safeToFixed(getDisplayFormattedWeight(Math.abs(fatChange), KILOGRAMS, isImperial)),
                    muscle: safeToFixed(getDisplayFormattedWeight(Math.abs(muscleChange), KILOGRAMS, isImperial)),
                    weightUnit,
                }),
            ];
        }

        return [];
    }, [eatingPhase, isImperial, metricsAverages, t, weightUnit]);

    return (
        <>
            <LineChart
                data={weightData}
                granularity={showWeeklyAverages ? 1 : 3}
                labels={weightLabels}
                title={t('weight', { weightUnit })}
                xAxisLabel={t('date')}
                yAxis={yAxisConfig}
                yAxisLabel={t('weight', { weightUnit })}
            />
            <WeightAndFatMetricsInfo
                bodyFatExamplesMessage={bodyFatExamplesMessage}
                currentWeightChangeRateMessage={currentWeightChangeRateMessage}
                idealWeightChangeRateMessage={idealWeightChangeRateMessage}
                muscleFatChangeMessage={muscleFatChangeMessage}
                totalBodyFatWeightMessage={totalBodyFatWeightMessage}
            />
        </>
    );
};

export default WeightLineChart;
