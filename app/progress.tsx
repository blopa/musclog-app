import { useMemo } from 'react';
import { View } from 'react-native';

import { TdeeCard } from '../components/cards/TdeeCard';
import { MasterLayout } from '../components/MasterLayout';
import { useUser } from '../hooks/useUser';
import { useUserMetrics } from '../hooks/useUserMetrics';
import { calculateBMR, calculateTDEE } from '../utils/nutritionCalculator';

export default function ProgressScreen() {
  const { user, isLoading: userLoading } = useUser();
  const { metrics, isLoading: metricsLoading } = useUserMetrics();

  // Calculate TDEE when user and metrics data is available
  const tdeeValue = useMemo(() => {
    if (!user || !metrics?.weight || !metrics?.height) {
      return 2850; // fallback value
    }

    try {
      // Calculate BMR first
      const bmr = calculateBMR(
        user.gender,
        metrics.weight, // weight is already in kg (display units converted in hook)
        metrics.height, // height is already in cm (display units converted in hook)
        user.getAge()
      );

      // Calculate TDEE using BMR and activity level
      const tdee = calculateTDEE({
        bmr,
        activityLevel: user.activityLevel,
        liftingExperience: user.liftingExperience,
      });

      return tdee || 2850; // fallback if calculation fails
    } catch (error) {
      console.error('Error calculating TDEE:', error);
      return 2850; // fallback value
    }
  }, [user, metrics]);

  const isLoading = userLoading || metricsLoading;

  return (
    <MasterLayout>
      <View className="flex-1 items-center justify-center p-4">
        <TdeeCard 
          tdeeValue={tdeeValue}
          subtitle={isLoading ? "Loading..." : "Current TDEE"}
          tagText="BASED ON RECENT ACTIVITY & NUTRITION"
        />
      </View>
    </MasterLayout>
  );
}