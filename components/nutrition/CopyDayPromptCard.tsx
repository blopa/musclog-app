import { CalendarPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

type CopyDayPromptCardProps = {
  onPress: () => void;
};

/**
 * Shown in the food diary when the selected day has no logged food yet. Repeating a
 * previous day is the most common reason a day starts empty, so the offer sits at the
 * moment of highest intent rather than behind a menu.
 */
export function CopyDayPromptCard({ onPress }: CopyDayPromptCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="card">
      <View className="flex-col items-center gap-4 p-6">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.status.info20 }}
        >
          <CalendarPlus size={theme.iconSize['3xl']} color={theme.colors.status.info} />
        </View>

        <View className="flex-col items-center gap-1" style={{ maxWidth: theme.maxWidth['480'] }}>
          <Text className="text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
            {t('food.actions.copyDayPromptTitle')}
          </Text>
          <Text className="text-center text-sm font-normal leading-relaxed text-text-secondary">
            {t('food.actions.copyDayPromptDescription')}
          </Text>
        </View>

        <Button
          label={t('food.actions.copyDayFromHistory')}
          icon={CalendarPlus}
          variant="secondaryGradient"
          width="full"
          size="md"
          onPress={onPress}
        />
      </View>
    </GenericCard>
  );
}
