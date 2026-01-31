import { Copy, Pencil, Share2, Trash2 } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '../theme';
import { BottomPopUpMenu, BottomPopUpMenuItem } from './BottomPopUpMenu';

type WorkoutDetailsMenuProps = {
  visible: boolean;
  onClose: () => void;
  workoutName: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

export function WorkoutDetailsMenu({
  visible,
  onClose,
  workoutName,
  onEdit,
  onDuplicate,
  onShare,
  onDelete,
}: WorkoutDetailsMenuProps) {
  const { t } = useTranslation();

  const items: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.edit'),
      description: t('workoutDetails.editDescription'),
      onPress: () => onEdit?.(),
    },
    {
      icon: Copy,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.duplicate'),
      description: t('workoutDetails.duplicateDescription'),
      onPress: () => onDuplicate?.(),
    },
    {
      icon: Share2,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.share'),
      description: t('workoutDetails.shareDescription'),
      onPress: () => onShare?.(),
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('workoutDetails.delete'),
      description: t('workoutDetails.deleteDescription'),
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => onDelete?.(),
    },
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={workoutName}
      subtitle={t('workoutDetails.subtitle')}
      items={items}
    />
  );
}
