import {
  Clock,
  Edit,
  MoreHorizontal,
  PlusCircle,
  ScanLine,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { MealTypeButton } from '@/components/MealTypeButton';
import { Button } from '@/components/theme/Button';
import { ListGroup } from '@/components/theme/ListGroup';
import { SectionLabel } from '@/components/theme/SectionLabel';
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
  showTrackByMealType?: boolean;
  hasSavedMeals?: boolean;
  onTrackFromSavedPress?: () => void;
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
  showTrackByMealType = true,
  hasSavedMeals = false,
  onTrackFromSavedPress,
}: AddFoodModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const mealTypes: {
    icon: typeof UtensilsCrossed;
    label: string;
    mealType: MealType;
  }[] = [
    {
      icon: UtensilsCrossed,
      label: t('food.meals.breakfast'),
      mealType: 'breakfast',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.lunch'),
      mealType: 'lunch',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.dinner'),
      mealType: 'dinner',
    },
    {
      icon: UtensilsCrossed,
      label: t('food.meals.snacks'),
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
          {showTrackByMealType ? (
            <View>
              <SectionLabel className="mb-3">{t('food.addFoodModal.trackByMealType')}</SectionLabel>
              <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.md }}>
                {mealTypes.map((meal) => (
                  <View
                    key={meal.mealType}
                    style={{ flex: 1, minWidth: '30%', maxWidth: '33.333%' }}
                  >
                    <MealTypeButton
                      icon={meal.icon}
                      label={meal.label}
                      onPress={() => {
                        onMealTypeSelect?.(meal.mealType);
                        onClose();
                      }}
                    />
                  </View>
                ))}
                <View
                  style={{ flex: 2, minWidth: '60%', maxWidth: '66.666%', alignSelf: 'stretch' }}
                >
                  <MealTypeButton
                    icon={MoreHorizontal}
                    label={t('food.meals.other')}
                    span={2}
                    onPress={() => {
                      onMealTypeSelect?.('other' as MealType);
                      onClose();
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Tracking Method */}
          <View>
            <SectionLabel className="mb-3">{t('food.addFoodModal.trackingMethod')}</SectionLabel>
            <View className="gap-3">
              <ListGroup>
                <TrackingMethodButton
                  icon={Search}
                  title={t('food.addFoodModal.searchFood.title')}
                  description={t('food.addFoodModal.searchFood.description')}
                  onPress={() => {
                    onSearchFoodPress?.();
                    onClose();
                  }}
                />
                <TrackingMethodButton
                  icon={ScanLine}
                  title={t('food.addFoodModal.scanBarcode.title')}
                  description={t('food.addFoodModal.scanBarcode.description')}
                  onPress={() => {
                    onScanBarcodePress?.();
                    onClose();
                  }}
                />
                {isAiEnabled ? (
                  <TrackingMethodButton
                    icon={Sparkles}
                    title={t('food.addFoodModal.aiCamera.title')}
                    description={t('food.addFoodModal.aiCamera.description')}
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
                  onPress={() => {
                    onQuickTrackMealPress?.();
                    onClose();
                  }}
                />
                {hasSavedMeals ? (
                  <TrackingMethodButton
                    icon={Clock}
                    title={t('food.addFoodModal.trackFromSaved')}
                    description={t('food.addFoodModal.trackFromSavedDescription')}
                    onPress={() => {
                      onTrackFromSavedPress?.();
                      onClose();
                    }}
                  />
                ) : null}
              </ListGroup>
              <View className="flex-row items-stretch gap-3 pt-1">
                <Button
                  label={t('food.addFoodModal.createCustomFood')}
                  icon={Edit}
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
