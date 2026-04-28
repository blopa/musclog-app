import { Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { useTheme } from '@/hooks/useTheme';

type DailySummaryBottomMenuProps = {
  visible: boolean;
  onClose: () => void;
  onGoalsManagementPress: () => void;
};

export function DailySummaryBottomMenu({
  visible,
  onClose,
  onGoalsManagementPress,
}: DailySummaryBottomMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const dailySummaryMenuItems: BottomPopUpMenuItem[] = [
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
