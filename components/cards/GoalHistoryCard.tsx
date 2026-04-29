import { History, Pencil, RefreshCw, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUpMenu, BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { EatingPhaseBadge } from '@/components/EatingPhaseBadge';
import { MenuButton } from '@/components/theme/MenuButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { type EatingPhaseUI } from '@/types/EatingPhaseUI';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GenericCard } from './GenericCard';

interface GoalHistoryItem {
  id: string;
  dateRange: string;
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat?: number | null;
}

interface GoalHistoryCardProps {
  goal: GoalHistoryItem;
  isLast?: boolean;
  onEdit?: () => void;
  onRegenerateCheckins?: () => void;
  onDelete?: () => void;
  isRegenerating?: boolean;
}

export function GoalHistoryCard({
  goal,
  isLast = false,
  onEdit,
  onRegenerateCheckins,
  onDelete,
  isRegenerating = false,
}: GoalHistoryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal, locale } = useFormatAppNumber();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const weightDisplay = formatDisplayWeightKg(locale, units, goal.weight);
  const [menuVisible, setMenuVisible] = useState(false);
  const wasRegenerating = useRef(false);

  useEffect(() => {
    if (isRegenerating) {
      wasRegenerating.current = true;
    } else if (wasRegenerating.current) {
      wasRegenerating.current = false;
      setMenuVisible(false);
    }
  }, [isRegenerating]);

  const hasMenu = onEdit != null || onDelete != null;

  const menuItems: BottomPopUpMenuItem[] = [
    ...(onEdit
      ? [
          {
            icon: Pencil,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('goalsManagement.manageGoalData.editGoal'),
            description: t('goalsManagement.manageGoalData.editGoalDesc'),
            onPress: onEdit,
          },
        ]
      : []),
    ...(onRegenerateCheckins
      ? [
          {
            icon: RefreshCw,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('goalsManagement.manageGoalData.regenerateCheckins'),
            description: t('goalsManagement.manageGoalData.regenerateCheckinsDesc'),
            onPress: onRegenerateCheckins,
            keepOpenOnPress: true,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error10,
            title: t('goalsManagement.manageGoalData.deleteGoal'),
            description: t('goalsManagement.manageGoalData.deleteGoalDesc'),
            titleColor: theme.colors.status.error,
            onPress: onDelete,
          },
        ]
      : []),
  ];

  return (
    <View className="relative mb-6 flex-row gap-4">
      {/* Timeline line */}
      {!isLast ? (
        <View
          className="absolute left-[19px] top-10"
          style={{
            bottom: -24,
            width: 0.5,
            backgroundColor: theme.colors.border.emerald,
          }}
        />
      ) : null}

      {/* Timeline dot */}
      <View
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg-card"
        style={{ borderColor: theme.colors.border.emerald }}
      >
        <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>

      {/* Content */}
      <View className="flex-1 pb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-text-secondary">{goal.dateRange}</Text>
          <View className="flex-row items-center gap-1">
            <EatingPhaseBadge phase={goal.phase} variant="compact" showBorder={true} />
            {hasMenu ? <MenuButton size="sm" onPress={() => setMenuVisible(true)} /> : null}
          </View>
        </View>

        {hasMenu ? (
          <BottomPopUpMenu
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            title={t('goalsManagement.manageGoalData.goalOptions')}
            items={menuItems}
            isLoading={isRegenerating}
            loadingTitle={t('common.processing')}
          />
        ) : null}

        <GenericCard variant="card">
          <View className="p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-col">
                <Text className="text-lg font-bold text-text-primary">
                  {formatInteger(goal.calories)}{' '}
                  <Text
                    className="font-normal text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}
                  >
                    {t('goalHistoryCard.kcal')}
                  </Text>
                </Text>
                <Text
                  className="text-text-secondary"
                  style={{ fontSize: theme.typography.fontSize.xs }}
                >
                  {t('goalHistoryCard.proteinPrefix')}:{formatInteger(goal.protein)}
                  {t('goalHistoryCard.g')} • {t('goalHistoryCard.carbsPrefix')}:
                  {formatInteger(goal.carbs)}
                  {t('goalHistoryCard.g')} • {t('goalHistoryCard.fatPrefix')}:
                  {formatInteger(goal.fat)}
                  {t('goalHistoryCard.g')}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-text-secondary">
                  {weightDisplay} {t(weightUnitKey)}
                </Text>
                {goal.bodyFat != null ? (
                  <Text
                    className="text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}
                  >
                    {formatRoundedDecimal(goal.bodyFat, 1)}% {t('goalHistoryCard.bf')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </GenericCard>
      </View>
    </View>
  );
}
