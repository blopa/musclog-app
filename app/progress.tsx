import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { TdeeCard } from '../components/cards/TdeeCard';
import { MasterLayout } from '../components/MasterLayout';
import { useSettings } from '../hooks/useSettings';
import { useUser } from '../hooks/useUser';
import { useUserMetrics } from '../hooks/useUserMetrics';
import { getHistoricalNutritionParams, type HistoricalNutritionParams } from '../utils/historicalNutritionParams';
import { calculateTDEE } from '../utils/nutritionCalculator';

export default function ProgressScreen() {
  const { user, isLoading: userLoading } = useUser();
  const { metrics, isLoading: metricsLoading } = useUserMetrics();
  const { units } = useSettings();
  const [historicalData, setHistoricalData] = useState<HistoricalNutritionParams | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(true);

  // Fetch historical nutrition data
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setHistoricalLoading(true);
        const data = await getHistoricalNutritionParams({ units });
        setHistoricalData(data);
      } catch (error) {
        console.error('Error fetching historical nutrition data:', error);
        setHistoricalData(null);
      } finally {
        setHistoricalLoading(false);
      }
    };

    fetchHistoricalData();
  }, [units]);

  // Calculate TDEE when user and metrics data is available
  const tdeeValue = useMemo(() => {
    if (!user || !metrics?.weight || !metrics?.height) {
      return 2850; // fallback value
    }

    try {
      // Calculate TDEE with empirical data if available
      const tdeeParams: any = {
        // Fallback data
        activityLevel: user.activityLevel,
        liftingExperience: user.liftingExperience,
      };

      // Add empirical data if available
      if (historicalData) {
        tdeeParams.totalCalories = historicalData.historicalTotalCalories;
        tdeeParams.totalDays = historicalData.historicalTotalDays;
        tdeeParams.initialWeight = historicalData.historicalInitialWeightKg;
        tdeeParams.finalWeight = historicalData.historicalFinalWeightKg;
        if (historicalData.historicalInitialFatPercent !== undefined) {
          tdeeParams.initialFatPercentage = historicalData.historicalInitialFatPercent;
        }
        if (historicalData.historicalFinalFatPercent !== undefined) {
          tdeeParams.finalFatPercentage = historicalData.historicalFinalFatPercent;
        }
      }

      const tdee = calculateTDEE(tdeeParams);

      return tdee || 2850; // fallback if calculation fails
    } catch (error) {
      console.error('Error calculating TDEE:', error);
      return 2850; // fallback value
    }
  }, [user, metrics, historicalData]);

  const isLoading = userLoading || metricsLoading || historicalLoading;

  return (
    <MasterLayout>
      <View className="flex-1 items-center justify-center p-4">
        <TdeeCard
          tdeeValue={tdeeValue}
          subtitle={isLoading ? 'Loading...' : 'Current TDEE'}
          tagText="BASED ON RECENT ACTIVITY & NUTRITION"
        />
      </View>
    </MasterLayout>
  );
}
