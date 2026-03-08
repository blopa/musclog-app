import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TdeeCard } from '../components/cards/TdeeCard';
import { MasterLayout } from '../components/MasterLayout';
import { useEmpiricalTDEE } from '../hooks/useEmpiricalTDEE';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { tdee, isLoading, usedEmpiricalData } = useEmpiricalTDEE({
    lookbackDays: 30, // Default, but explicit for clarity
  });

  const tagText = usedEmpiricalData
    ? t('progress.basedOnRecentActivity')
    : t('progress.basedOnActivityLevel');

  return (
    <MasterLayout>
      <View className="flex-1 items-center justify-center p-4">
        <TdeeCard
          tdeeValue={tdee}
          subtitle={isLoading ? t('common.loading') : t('progress.currentTdee')}
          tagText={tagText}
        />
      </View>
    </MasterLayout>
  );
}
