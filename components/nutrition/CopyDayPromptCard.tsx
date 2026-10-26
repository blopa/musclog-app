import { CalendarPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/theme/ListRow';
import { useTheme } from '@/hooks/useTheme';

type CopyDayPromptCardProps = {
  onPress: () => void;
};

/**
 * Shown in the food diary when the selected day has no logged food yet. Repeating a
 * previous day is the most common reason a day starts empty, so the offer sits at the
 * moment of highest intent rather than behind a menu. A single row, so it does not push
 * the scan and add buttons below the fold.
 */
export function CopyDayPromptCard({ onPress }: CopyDayPromptCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ListRow
      variant="card"
      icon={CalendarPlus}
      iconColor={theme.colors.status.info}
      title={t('food.actions.copyDayFromHistory')}
      subtitle={t('food.actions.copyDayPromptDescription')}
      onPress={onPress}
    />
  );
}
