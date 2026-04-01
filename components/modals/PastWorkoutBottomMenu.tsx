import { List, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';

type PastWorkoutBottomMenuProps = {
  visible: boolean;
  onClose: () => void;
  workoutName: string;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
};

export function PastWorkoutBottomMenu({
  visible,
  onClose,
  workoutName,
  onEdit,
  onShare,
  onDelete,
  onPreview,
}: PastWorkoutBottomMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: List,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.preview'),
      description: t('workoutDetails.previewDescription'),
      onPress: () => {
        onClose();
        onPreview?.();
      },
    },
    // TODO: implement a modal that allow editing the past workout
    // {
    //   icon: Pencil,
    //   iconColor: theme.colors.text.primary,
    //   iconBgColor: theme.colors.text.primary20,
    //   title: t('workoutDetails.edit'),
    //   description: t('workoutDetails.editDescription'),
    //   onPress: () => {
    //     onClose();
    //     onEdit?.();
    //   },
    // },
    {
      icon: Share2,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.share'),
      description: t('workoutDetails.shareDescription'),
      onPress: () => {
        onClose();
        onShare?.();
      },
    },
    ...(onDelete
      ? [
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('workoutDetails.delete'),
            description: t('workoutDetails.deleteDescription'),
            titleColor: theme.colors.status.error,
            descriptionColor: theme.colors.status.error,
            onPress: () => {
              onClose();
              onDelete?.();
            },
          },
        ]
      : []),
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={workoutName}
      subtitle={t('workoutDetails.subtitle')}
      items={menuItems}
    />
  );
}
