import { View } from 'react-native';

import { TdeeCard } from '../components/cards/TdeeCard';
import { MasterLayout } from '../components/MasterLayout';

export default function ProgressScreen() {
  return (
    <MasterLayout>
      <View className="flex-1 items-center justify-center p-4">
        <TdeeCard 
          tdeeValue={2850}
          subtitle="Current TDEE"
          tagText="BASED ON RECENT ACTIVITY & NUTRITION"
        />
      </View>
    </MasterLayout>
  );
}