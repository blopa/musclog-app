import { Folder, Plus, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { useTheme } from '@/hooks/useTheme';

export type AddMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateMeal?: () => void;
  onGenerateMealAI?: () => void;
  onManageCategories?: () => void;
  isAiEnabled?: boolean;
};

export function AddMealModal({
  visible,
  onClose,
  onCreateMeal,
  onGenerateMealAI,
  onManageCategories,
  isAiEnabled = true,
}: AddMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const items = [
    {
      icon: Plus,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('addMeal.createMeal'),
      description: t('addMeal.createMealDesc'),
      onPress: () => onCreateMeal?.(),
    },
    ...(isAiEnabled
      ? [
          {
            icon: Sparkles,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('addMeal.generateMealAI'),
            description: t('addMeal.generateMealAIDesc'),
            onPress: () => onGenerateMealAI?.(),
          },
        ]
      : []),
    ...(onManageCategories
      ? [
          {
            icon: Folder,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('addMeal.manageCategories'),
            description: t('addMeal.manageCategoriesDesc'),
            onPress: onManageCategories,
          },
        ]
      : []),
  ];

  return (
    <BottomPopUpMenu visible={visible} onClose={onClose} title={t('addMeal.title')} items={items} />
  );
}
