import React from 'react';
import { Plus, Sparkles, Folder } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';

export type AddMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateMeal?: () => void;
  onGenerateMealAI?: () => void;
  onManageCategories?: () => void;
};

export function AddMealModal({
  visible,
  onClose,
  onCreateMeal,
  onGenerateMealAI,
  onManageCategories,
}: AddMealModalProps) {
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
    {
      icon: Sparkles,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('addMeal.generateMealAI'),
      description: t('addMeal.generateMealAIDesc'),
      onPress: () => onGenerateMealAI?.(),
    },
    {
      icon: Folder,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('addMeal.manageCategories'),
      description: t('addMeal.manageCategoriesDesc'),
      onPress: () => onManageCategories?.(),
    },
  ];

  return (
    <BottomPopUpMenu visible={visible} onClose={onClose} title={t('addMeal.title')} items={items} />
  );
}
