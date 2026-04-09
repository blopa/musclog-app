import { Copy, Eye, Pencil, Share2, Trash2 } from 'lucide-react-native';
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
