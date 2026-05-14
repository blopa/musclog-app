import { Pencil, Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { useTheme } from '@/hooks/useTheme';

type DailySummaryBottomMenuProps = {
  visible: boolean;
  onClose: () => void;
  onGoalsManagementPress: () => void;
  onEditCurrentGoalPress?: () => void;
  showEditCurrentGoal?: boolean;
};

export function DailySummaryBottomMenu({
  visible,
  onClose,
  onGoalsManagementPress,
  onEditCurrentGoalPress,
  showEditCurrentGoal = false,
}: DailySummaryBottomMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const dailySummaryMenuItems: BottomPopUpMenuItem[] = [
    ...(showEditCurrentGoal && onEditCurrentGoalPress
      ? [
          {
            icon: Pencil,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('goalsManagement.manageGoalData.editGoal'),
            description: t('goalsManagement.manageGoalData.editGoalDesc'),
            onPress: onEditCurrentGoalPress,
          },
        ]
      : []),
    {
      icon: Scale,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('settings.advancedSettings.manageGoalsData'),
      description: t('settings.advancedSettings.manageGoalsDataSubtitle'),
      onPress: onGoalsManagementPress,
    },
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('dailySummaryCard.dailySummary')}
      items={dailySummaryMenuItems}
    />
  );
}
