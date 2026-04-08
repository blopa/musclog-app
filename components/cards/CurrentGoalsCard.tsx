import {
  Activity,
  Calculator,
  Calendar,
  Pencil,
  Percent,
  RefreshCw,
  Scale,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { EatingPhaseBadge } from '@/components/EatingPhaseBadge';
import { MenuButton } from '@/components/theme/MenuButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { type EatingPhaseUI } from '@/types/EatingPhaseUI';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GenericCard } from './GenericCard';

interface CurrentGoal {
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number;
  ffmi?: number;
  bmi?: number;
  goalDate?: string;
}

interface CurrentGoalsCardProps {
  goal: CurrentGoal;
  onEdit?: () => void;
  onRegenerateCheckins?: () => void;
  onDelete?: () => void;
  isRegenerating?: boolean;
}

export function CurrentGoalsCard({
  goal,
  onEdit,
  onRegenerateCheckins,
  onDelete,
  isRegenerating = false,
}: CurrentGoalsCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal, locale } = useFormatAppNumber();
  const { width: windowWidth } = useWindowDimensions();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const targetWeightDisplay =
    goal.targetWeight != null ? formatDisplayWeightKg(locale, units, goal.targetWeight) : undefined;
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
    <GenericCard variant="card">
      <View className="relative p-5">
        {/* Daily Target */}
        <View className="mb-6">
          <Text
            className="mb-1 font-medium uppercase tracking-wider text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.xs }}
          >
            {t('currentGoalsCard.dailyTarget')}
          </Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="text-4xl font-extrabold tracking-tighter text-text-primary">
              {formatInteger(goal.calories)}
            </Text>
            <Text className="text-sm font-bold uppercase text-accent-primary">
              {t('currentGoalsCard.kcal')}
            </Text>
          </View>
        </View>

        {/* Macros Grid */}
        <View className="border-border flex-row gap-4 border-t pt-4">
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {windowWidth < 380
                ? t('currentGoalsCard.proteinShort')
                : t('currentGoalsCard.protein')}
            </Text>
            <Text className="font-bold text-text-primary">
              {formatInteger(goal.protein)}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {windowWidth < 380 ? t('currentGoalsCard.carbsShort') : t('currentGoalsCard.carbs')}
            </Text>
            <Text className="font-bold text-text-primary">
              {formatInteger(goal.carbs)}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {windowWidth < 380 ? t('currentGoalsCard.fatsShort') : t('currentGoalsCard.fats')}
            </Text>
            <Text className="font-bold text-text-primary">
              {formatInteger(goal.fat)}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
        </View>

        {/* Goal Date */}
        {goal.goalDate ? (
          <View className="mt-4">
            <View className="flex-row items-center gap-2">
              <Calendar size={theme.iconSize.md} color={theme.colors.text.secondary} />
              <Text className="text-xs font-semibold text-text-secondary">{goal.goalDate}</Text>
            </View>
          </View>
        ) : null}

        {/* Target Metrics */}
        {goal.targetWeight !== undefined ||
        goal.bodyFat !== undefined ||
        goal.ffmi !== undefined ||
        goal.bmi !== undefined ? (
          <View
            className="mt-4 flex-row flex-wrap gap-4 rounded-lg p-3"
            style={{ backgroundColor: theme.colors.background.darkGreen50 }}
          >
            {targetWeightDisplay !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Scale size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.targetWeight')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {targetWeightDisplay}{' '}
                    <Text
                      className="text-text-secondary"
                      style={{ fontSize: theme.typography.fontSize.xs }}
                    >
                      {t(weightUnitKey)}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.bodyFat !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Percent size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.bodyFat')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {formatRoundedDecimal(goal.bodyFat, 1)}{' '}
                    <Text
                      className="text-text-secondary"
                      style={{ fontSize: theme.typography.fontSize.xs }}
                    >
                      {t('currentGoalsCard.percent')}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.ffmi !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Activity size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.ffmi')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {formatRoundedDecimal(goal.ffmi, 1)}
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.bmi !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Calculator size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.bmi')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {formatRoundedDecimal(goal.bmi, 1)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Top-right: Eating Phase Badge + Menu Button — rendered last to win touch priority */}
        <View className="absolute right-0 top-0 flex-row items-center gap-1 p-3">
          <EatingPhaseBadge phase={goal.phase} variant="default" showBorder={false} />
          {hasMenu ? <MenuButton size="sm" onPress={() => setMenuVisible(true)} /> : null}
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
      </View>
    </GenericCard>
  );
}
