import {
  Clock,
  Edit,
  MoreHorizontal,
  PlusCircle,
  QrCode,
  ScanLine,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { MealTypeButton } from '@/components/MealTypeButton';
import { Button } from '@/components/theme/Button';
import { TrackingMethodButton } from '@/components/TrackingMethodButton';
import { MealType } from '@/database/models';
import { useTheme } from '@/hooks/useTheme';

type AddFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onMealTypeSelect?: (mealType: MealType) => void;
  onAiCameraPress?: () => void;
  onScanBarcodePress?: () => void;
  onSearchFoodPress?: () => void;
  onCreateCustomFoodPress?: () => void;
  onTrackCustomMealPress?: () => void;
  onQuickTrackMealPress?: () => void;
  isAiEnabled?: boolean;
};

export function AddFoodModal({
  visible,
  onClose,
  onMealTypeSelect,
  onAiCameraPress,
  onScanBarcodePress,
  onSearchFoodPress,
  onCreateCustomFoodPress,
  onTrackCustomMealPress,
  onQuickTrackMealPress,
  isAiEnabled = true,
}: AddFoodModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const mealTypes: {
    icon: typeof UtensilsCrossed;
    label: string;
    iconBgColor: string;
    iconColor: string;
    mealType: MealType;
  }[] = [
    {
      icon: UtensilsCrossed,
      label: t('food.meals.breakfast'),
      iconBgColor: theme.colors.status.warning10,
      iconColor: theme.colors.status.warning,
      mealType: 'breakfast',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.lunch'),
      iconBgColor: theme.colors.status.emerald10,
      iconColor: theme.colors.status.emerald,
      mealType: 'lunch',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.dinner'),
      iconBgColor: theme.colors.status.indigo10,
      iconColor: theme.colors.status.indigo,
      mealType: 'dinner',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.snacks'),
      iconBgColor: theme.colors.status.yellow10,
      iconColor: theme.colors.status.yellow,
      mealType: 'snack',
    },
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('food.addFoodModal.title')}
      subtitle={t('food.addFoodModal.subtitle')}
      maxHeight="92%"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.padding.xl }}
      >
        <View className="gap-8">
          {/* Track by Meal Type */}
          <View>
            <View className="mb-4 flex-row items-center gap-2">
              <Clock size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('food.addFoodModal.trackByMealType')}
              </Text>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.md }}>
              {mealTypes.map((meal) => (
                <View key={meal.mealType} style={{ flex: 1, minWidth: '30%', maxWidth: '33.333%' }}>
                  <MealTypeButton
                    icon={meal.icon}
                    label={meal.label}
                    iconBgColor={meal.iconBgColor}
                    iconColor={meal.iconColor}
                    onPress={() => {
                      onMealTypeSelect?.(meal.mealType);
                      onClose();
                    }}
                  />
                </View>
              ))}
              <View style={{ flex: 2, minWidth: '60%', maxWidth: '66.666%', alignSelf: 'stretch' }}>
                <MealTypeButton
                  icon={MoreHorizontal}
                  label={t('food.meals.other')}
                  iconBgColor={theme.colors.status.gray10}
                  iconColor={theme.colors.text.secondary}
                  span={2}
                  onPress={() => {
                    onMealTypeSelect?.('other' as MealType);
                    onClose();
                  }}
                />
              </View>
            </View>
          </View>

          {/* Tracking Method */}
          <View>
            <View className="mb-4 flex-row items-center gap-2">
              <QrCode size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('food.addFoodModal.trackingMethod')}
              </Text>
            </View>
            <View className="gap-3">
              {isAiEnabled ? (
                <TrackingMethodButton
                  icon={Sparkles}
                  title={t('food.addFoodModal.aiCamera.title')}
                  description={t('food.addFoodModal.aiCamera.description')}
                  iconGradient={
                    [theme.colors.status.indigo, theme.colors.status.emeraldLight] as const
                  }
                  badge={t('food.addFoodModal.aiCamera.badge')}
                  highlighted={true}
                  onPress={() => {
                    onAiCameraPress?.();
                    onClose();
                  }}
                />
              ) : null}
              <TrackingMethodButton
                icon={PlusCircle}
                title={t('food.addFoodModal.quickTrackMeal')}
                description={t('food.addFoodModal.quickTrackMealDescription')}
                iconBgColor={theme.colors.status.purple10}
                onPress={() => {
                  onQuickTrackMealPress?.();
                  onClose();
                }}
              />
              <TrackingMethodButton
                icon={ScanLine}
                title={t('food.addFoodModal.scanBarcode.title')}
                description={t('food.addFoodModal.scanBarcode.description')}
                iconBgColor={theme.colors.background.secondaryDark}
                onPress={() => {
                  onScanBarcodePress?.();
                  onClose();
                }}
              />
              <TrackingMethodButton
                icon={Search}
                title={t('food.addFoodModal.searchFood.title')}
                description={t('food.addFoodModal.searchFood.description')}
                iconBgColor={theme.colors.background.secondaryDark}
                onPress={() => {
                  onSearchFoodPress?.();
                  onClose();
                }}
              />
              <View className="flex-row items-stretch gap-3 pt-1">
                <Button
                  label={t('food.addFoodModal.createCustomFood')}
                  icon={Edit}
                  iconBgColor={theme.colors.status.info10}
                  iconColor={theme.colors.status.info}
                  variant="outline"
                  size="sm"
                  width="flex-1"
                  onPress={() => {
                    onCreateCustomFoodPress?.();
                    onClose();
                  }}
                />
                <Button
                  label={t('food.addFoodModal.trackCustomMeal')}
                  icon={UtensilsCrossed}
                  iconBgColor={theme.colors.status.purple10}
                  iconColor={theme.colors.status.purple}
                  variant="outline"
                  size="sm"
                  width="flex-1"
                  onPress={() => {
                    onTrackCustomMealPress?.();
                    onClose();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </BottomPopUpMenu>
  );
}
