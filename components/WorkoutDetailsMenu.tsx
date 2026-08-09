import { Copy, Eye, FolderPlus, Pencil, Share2, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/useTheme';

import { BottomPopUpMenu, BottomPopUpMenuItem } from './BottomPopUpMenu';

type WorkoutDetailsMenuProps = {
  visible: boolean;
  onClose: () => void;
  workoutName: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onAddToPlan?: () => void;
  nestedModals?: ReactNode;
};

export function WorkoutDetailsMenu({
  visible,
  onClose,
  workoutName,
  onEdit,
  onDuplicate,
  onShare,
  onDelete,
  onPreview,
  onAddToPlan,
  nestedModals,
}: WorkoutDetailsMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const items: BottomPopUpMenuItem[] = [
    {
      icon: Eye,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.preview'),
      description: t('workoutDetails.previewDescription'),
      onPress: () => onPreview?.(),
    },
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
      icon: FolderPlus,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workouts.plans.addToPlan'),
      description: t('workouts.plans.addToPlanDescription'),
      onPress: () => onAddToPlan?.(),
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
      nestedModals={nestedModals}
    />
  );
}
