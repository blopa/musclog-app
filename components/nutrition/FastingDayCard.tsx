import { Coffee } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

type FastingDayCardProps = {
  isFasted: boolean;
  onMark: () => void;
  onUnmark: () => void;
  loading?: boolean;
};

/**
 * Shown in the food diary when the selected day has no logged food and the fasting-day feature
 * is enabled. Lets the user flag the day as an intentional fast (a real 0-kcal day) or clear the
 * flag. Marking is confirmed by the caller via a ConfirmationModal.
 */
export function FastingDayCard({ isFasted, onMark, onUnmark, loading = false }: FastingDayCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="card">
      <View className="flex-col items-center gap-4 p-6">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.status.emerald20 }}
        >
          <Coffee size={theme.iconSize['3xl']} color={theme.colors.status.emeraldLight} />
        </View>

        <View className="flex-col items-center gap-1" style={{ maxWidth: theme.maxWidth['480'] }}>
          <Text className="text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
            {isFasted ? t('food.fastingDay.fastedTitle') : t('food.fastingDay.markTitle')}
          </Text>
          <Text className="text-center text-sm font-normal leading-relaxed text-text-secondary">
            {isFasted
              ? t('food.fastingDay.fastedDescription')
              : t('food.fastingDay.markDescription')}
          </Text>
        </View>

        <Button
          label={
            isFasted ? t('food.fastingDay.unmarkButton') : t('food.fastingDay.markButton')
          }
          icon={Coffee}
          variant={isFasted ? 'secondary' : 'secondaryGradient'}
          width="full"
          size="md"
          loading={loading}
          onPress={isFasted ? onUnmark : onMark}
        />
      </View>
    </GenericCard>
  );
}
