import { View } from 'react-native';

import { TdeeCard } from '../components/cards/TdeeCard';
import { MasterLayout } from '../components/MasterLayout';
import { useEmpiricalTDEE } from '../hooks/useEmpiricalTDEE';

export default function ProgressScreen() {
  const { tdee, isLoading, usedEmpiricalData } = useEmpiricalTDEE({
    lookbackDays: 30, // Default, but explicit for clarity
  });

  // TODO: use i18n
  const tagText = usedEmpiricalData 
    ? "BASED ON RECENT ACTIVITY & NUTRITION" 
    : "BASED ON ACTIVITY LEVEL & STATS";

  return (
    <MasterLayout>
      <View className="flex-1 items-center justify-center p-4">
        <TdeeCard
          tdeeValue={tdee}
          // TODO: use i18n
          subtitle={isLoading ? 'Loading...' : 'Current TDEE'}
          tagText={tagText}
        />
      </View>
    </MasterLayout>
  );
}
