import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Clock,
  QrCode,
  Sparkles,
  ScanLine,
  Search,
  Edit,
  UtensilsCrossed,
  ArrowRight,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { BottomPopUpMenu } from './BottomPopUpMenu';
import { Button } from './theme/Button';

type AddFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onMealTypeSelect?: (mealType: string) => void;
  onAiCameraPress?: () => void;
  onScanBarcodePress?: () => void;
  onSearchFoodPress?: () => void;
  onCreateCustomFoodPress?: () => void;
  onTrackCustomMealPress?: () => void;
};

type MealTypeButtonProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  iconBgColor: string;
  iconColor: string;
  onPress: () => void;
  span?: number;
};

function MealTypeButton({
  icon: Icon,
  label,
  iconBgColor,
  iconColor,
  onPress,
  span = 1,
}: MealTypeButtonProps) {
  return (
    <Pressable
      className={`${
        span === 2 ? 'flex-row' : 'flex-col'
      } active:scale-95 items-center justify-center gap-2 rounded-2xl border border-border-default bg-bg-overlay p-3 active:bg-bg-card-elevated`}
      onPress={onPress}>
      <View
        className={`${span === 2 ? 'h-8 w-8' : 'h-10 w-10'} items-center justify-center rounded-full`}
        style={{ backgroundColor: iconBgColor }}>
        <Icon size={span === 2 ? theme.iconSize.sm : theme.iconSize.md} color={iconColor} />
      </View>
      <Text className="text-xs font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}

type TrackingMethodButtonProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  description: string;
  iconBgColor?: string;
  iconGradient?: readonly [string, string, ...string[]];
  badge?: string;
  highlighted?: boolean;
  onPress: () => void;
};

function TrackingMethodButton({
  icon: Icon,
  title,
  description,
  iconBgColor,
  iconGradient,
  badge,
  highlighted = false,
  onPress,
}: TrackingMethodButtonProps) {
  const IconContainer = iconGradient ? (
    <LinearGradient
      colors={iconGradient as readonly [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-12 w-12 items-center justify-center rounded-xl"
      style={{ ...theme.shadows.md }}>
      <Icon size={theme.iconSize.lg} color={theme.colors.text.white} />
    </LinearGradient>
  ) : (
    <View
      className="h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: iconBgColor || theme.colors.background.cardDark }}>
      <Icon size={theme.iconSize.md} color={theme.colors.text.primary} />
    </View>
  );

  return (
    <Pressable
      className={`active:scale-[0.98] flex-row items-center gap-4 rounded-2xl border p-4 ${
        highlighted
          ? 'bg-bg-overlay active:bg-bg-card-elevated'
          : 'bg-bg-overlay border-border-default active:bg-bg-card-elevated'
      }`}
      style={{
        borderColor: highlighted
          ? theme.colors.accent.primary40
          : theme.colors.border.default,
      }}
      onPress={onPress}>
      {IconContainer}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-text-primary">{title}</Text>
          {badge && (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: theme.colors.accent.primary }}>
              <Text
                className="text-[10px] font-extrabold uppercase text-text-black"
                style={{ fontSize: 10 }}>
                {badge}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-xs text-text-secondary">{description}</Text>
      </View>
      {highlighted ? (
        <ArrowRight size={theme.iconSize.md} color={theme.colors.accent.primary} />
      ) : (
        <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
      )}
    </Pressable>
  );
}

export function AddFoodModal({
  visible,
  onClose,
  onMealTypeSelect,
  onAiCameraPress,
  onScanBarcodePress,
  onSearchFoodPress,
  onCreateCustomFoodPress,
  onTrackCustomMealPress,
}: AddFoodModalProps) {
  const { t } = useTranslation();

  const mealTypes = [
    {
      icon: UtensilsCrossed,
      label: 'Breakfast',
      iconBgColor: 'rgba(249, 115, 22, 0.1)',
      iconColor: '#f97316',
      mealType: 'breakfast',
    },
    {
      icon: UtensilsCrossed,
      label: 'Lunch',
      iconBgColor: 'rgba(16, 185, 129, 0.1)',
      iconColor: '#10b981',
      mealType: 'lunch',
    },
    {
      icon: UtensilsCrossed,
      label: 'Dinner',
      iconBgColor: 'rgba(99, 102, 241, 0.1)',
      iconColor: '#6366f1',
      mealType: 'dinner',
    },
    {
      icon: UtensilsCrossed,
      label: 'Snack',
      iconBgColor: 'rgba(234, 179, 8, 0.1)',
      iconColor: '#eab308',
      mealType: 'snack',
    },
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title="Add Food"
      subtitle="Choose a method to track your meal"
      maxHeight="92%">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.padding.xl }}>
        <View className="gap-8">
          {/* Track by Meal Type */}
          <View>
            <View className="mb-4 flex-row items-center gap-2">
              <Clock size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Track by Meal Type
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
              <View style={{ flex: 2, minWidth: '60%', maxWidth: '66.666%' }}>
                <MealTypeButton
                  icon={MoreHorizontal}
                  label="Track Other"
                  iconBgColor="rgba(107, 114, 128, 0.1)"
                  iconColor={theme.colors.text.secondary}
                  span={2}
                  onPress={() => {
                    onMealTypeSelect?.('other');
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
                Tracking Method
              </Text>
            </View>
            <View className="gap-3">
              <TrackingMethodButton
                icon={Sparkles}
                title="AI Camera"
                description="Instant recognition & macro estimation"
                iconGradient={['#6366f1', '#29e08e'] as const}
                badge="NEW"
                highlighted={true}
                onPress={() => {
                  onAiCameraPress?.();
                  onClose();
                }}
              />
              <TrackingMethodButton
                icon={ScanLine}
                title="Scan Barcode"
                description="Quickly add packaged foods"
                iconBgColor={theme.colors.background.cardDark}
                onPress={() => {
                  onScanBarcodePress?.();
                  onClose();
                }}
              />
              <TrackingMethodButton
                icon={Search}
                title="Search for Food"
                description="Search our database of 2M+ items"
                iconBgColor={theme.colors.background.cardDark}
                onPress={() => {
                  onSearchFoodPress?.();
                  onClose();
                }}
              />
              <View className="flex-row gap-3 pt-1">
                <Button
                  label="Create Custom Food"
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
                  label="Track Custom Meal"
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

