import { CalendarCheck, Dumbbell, type LucideIcon, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

const POINTS: readonly { key: string; icon: LucideIcon; textKey: string }[] = [
  { key: 'training', icon: Dumbbell, textKey: 'weeklyReview.welcome.training' },
  { key: 'nutrition', icon: Utensils, textKey: 'weeklyReview.welcome.nutrition' },
  { key: 'control', icon: CalendarCheck, textKey: 'weeklyReview.welcome.control' },
];

/**
 * The one-time introduction shown the first time a Weekly Review has something in it. `onClose`
 * is the only way out and is where the caller records that it was seen.
 */
export function WeeklyReviewWelcome({
  weekdayLabel,
  onClose,
}: {
  /** The review day, already localized ("Monday"). */
  weekdayLabel: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <BottomPopUp
      visible
      onClose={onClose}
      title={t('weeklyReview.welcome.title')}
      subtitle={t('weeklyReview.welcome.subtitle')}
      footer={<Button label={t('weeklyReview.welcome.cta')} width="full" onPress={onClose} />}
    >
      <View className="gap-4 pb-4" testID="weekly-review-welcome">
        {POINTS.map(({ key, icon: Icon, textKey }) => (
          <View key={key} className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10">
              <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <Text className="flex-1 text-sm text-text-secondary">
              {t(textKey, { weekday: weekdayLabel })}
            </Text>
          </View>
        ))}
      </View>
    </BottomPopUp>
  );
}
