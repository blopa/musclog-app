import { CalendarPlus, Pencil, QrCode, Scale, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';

type DailySummaryBottomMenuProps = {
  visible: boolean;
  onClose: () => void;
  onGoalsManagementPress: () => void;
  onEditCurrentGoalPress?: () => void;
  showEditCurrentGoal?: boolean;
  onCopyDayFromHistoryPress?: () => void;
  /** Omitted when the day has nothing logged — there would be nothing to send. */
  onSendDayToPhonePress?: () => void;
  /**
   * The way into Weekly Review from Food on the days no review card is shown; its supporting line
   * says where today's targets come from ("Daily automatic targets · since Oct 12").
   */
  weeklyReview?: { onPress: () => void; targetsSummary: string };
};

export function DailySummaryBottomMenu({
  visible,
  onClose,
  onGoalsManagementPress,
  onEditCurrentGoalPress,
  showEditCurrentGoal = false,
  onCopyDayFromHistoryPress,
  onSendDayToPhonePress,
  weeklyReview,
}: DailySummaryBottomMenuProps) {
  const { t } = useTranslation();

  const dailySummaryMenuItems: BottomPopUpMenuItem[] = [
    ...(showEditCurrentGoal && onEditCurrentGoalPress
      ? [
          {
            icon: Pencil,
            showChevron: true,
            title: t('goalsManagement.manageGoalData.editGoal'),
            description: t('goalsManagement.manageGoalData.editGoalDesc'),
            onPress: onEditCurrentGoalPress,
          },
        ]
      : []),
    ...(onCopyDayFromHistoryPress
      ? [
          {
            icon: CalendarPlus,
            showChevron: true,
            title: t('food.actions.copyDayFromHistory'),
            description: t('food.actions.copyDayFromHistoryDesc'),
            onPress: onCopyDayFromHistoryPress,
          },
        ]
      : []),
    ...(onSendDayToPhonePress
      ? [
          {
            icon: QrCode,
            showChevron: true,
            title: t('food.actions.sendDayToPhone'),
            description: t('food.actions.sendDayToPhoneDesc'),
            onPress: onSendDayToPhonePress,
          },
        ]
      : []),
    ...(weeklyReview
      ? [
          {
            icon: Target,
            title: t('weeklyReview.title'),
            description: weeklyReview.targetsSummary,
            showChevron: true,
            testID: 'weekly-review-entry',
            onPress: weeklyReview.onPress,
          },
        ]
      : []),
    {
      icon: Scale,
      showChevron: true,
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
