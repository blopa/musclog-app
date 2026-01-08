import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Search, QrCode, Plus, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';

type FoodItem = {
  id: string;
  name: string;
  description: string;
  icon?: string; // Emoji or icon name
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
};

type FoodSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  mealType: string; // e.g., "Breakfast", "Lunch", etc.
  onCreatePress?: () => void;
  onBarcodeScanPress?: () => void;
  onFoodSelect?: (food: FoodItem) => void;
};

const FILTER_TABS = [
  { id: 'all', label: 'All Results' },
  { id: 'myFoods', label: 'My Foods' },
  { id: 'meals', label: 'Meals' },
  { id: 'recipes', label: 'Recipes' },
];

const RECENT_HISTORY: FoodItem[] = [
  {
    id: '1',
    name: 'Banana (Large)',
    description: '1 large (136g) • 121 kcal',
    icon: '🍌',
    iconColor: theme.colors.status.warning,
    iconBgColor: 'rgba(249, 115, 22, 0.1)', // warning20
    grade: 'A',
    gradeColor: theme.colors.accent.primary,
  },
  {
    id: '2',
    name: 'Large Egg',
    description: '1 large • 72 kcal • 6g Protein',
    iconColor: theme.colors.status.info,
    iconBgColor: 'rgba(59, 130, 246, 0.1)', // info20
    grade: 'A+',
    gradeColor: theme.colors.status.success,
  },
];

const COMMON_FOODS: FoodItem[] = [
  {
    id: '3',
    name: 'Oatmeal & Berries',
    description: '1 bowl • 350 kcal',
    // No image - will show placeholder
  },
  {
    id: '4',
    name: 'Black Coffee',
    description: '1 cup (8oz) • 2 kcal',
    iconColor: theme.colors.status.warning,
    iconBgColor: 'rgba(249, 115, 22, 0.1)', // warning20
  },
  {
    id: '5',
    name: 'Whole Wheat Toast',
    description: '2 slices • 180 kcal',
    iconColor: theme.colors.status.purple,
    iconBgColor: theme.colors.status.purple20,
  },
  {
    id: '6',
    name: 'Greek Yogurt',
    description: '1 cup (170g) • 100 kcal • 18g Protein',
    iconColor: theme.colors.status.error,
    iconBgColor: theme.colors.status.error20,
  },
];

type UnderlineTabsProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

function UnderlineTabs({ tabs, activeTab, onTabChange }: UnderlineTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row"
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.padding.base,
        paddingTop: theme.spacing.padding.sm,
        gap: 24,
      }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            className="pb-3"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: isActive ? theme.colors.accent.secondary : 'transparent',
            }}>
            <Text
              className="whitespace-nowrap text-sm"
              style={{
                color: isActive ? theme.colors.accent.secondary : theme.colors.text.secondary,
                fontWeight: isActive
                  ? theme.typography.fontWeight.semibold
                  : theme.typography.fontWeight.medium,
              }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type FoodItemCardProps = {
  food: FoodItem;
  onAddPress: () => void;
};

function FoodItemCard({ food, onAddPress }: FoodItemCardProps) {
  return (
    <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border-light bg-bg-overlay p-3 active:scale-[0.98]">
      {/* Icon/Image */}
      <View
        className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{
          backgroundColor: food.iconBgColor || theme.colors.background.cardDark,
          borderColor: food.iconColor ? `${food.iconColor}20` : 'transparent',
        }}>
        {food.image ? (
          <Image
            source={food.image}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : food.icon ? (
          <Text className="text-xl">{food.icon}</Text>
        ) : (
          <View className="h-full w-full opacity-80" />
        )}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 truncate pr-2 font-semibold text-text-primary" numberOfLines={1}>
            {food.name}
          </Text>
          {food.grade && (
            <View
              className="rounded border px-1.5 py-0.5"
              style={{
                backgroundColor: `${food.gradeColor || theme.colors.accent.primary}10`,
                borderColor: `${food.gradeColor || theme.colors.accent.primary}20`,
              }}>
              <Text
                className="text-[10px] font-bold"
                style={{ color: food.gradeColor || theme.colors.accent.primary }}>
                {food.grade}
              </Text>
            </View>
          )}
        </View>
        <Text className="truncate text-sm text-text-secondary" numberOfLines={1}>
          {food.description}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        className="h-8 w-8 items-center justify-center rounded-full bg-bg-overlay active:bg-accent-primary"
        onPress={onAddPress}
        style={{
          backgroundColor: theme.colors.background.cardDark,
        }}>
        <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </Pressable>
    </Pressable>
  );
}

type SectionHeaderProps = {
  title: string;
  icon?: typeof Sparkles;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
};

function SectionHeader({ title, icon: Icon, rightAction }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between px-1">
      <View className="flex-row items-center gap-2">
        {Icon && <Icon size={theme.iconSize.sm} color={theme.colors.accent.secondary} />}
        <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {title}
        </Text>
      </View>
      {rightAction && (
        <Pressable onPress={rightAction.onPress}>
          <Text className="text-xs font-bold text-accent-secondary">{rightAction.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function FoodSearchModal({
  visible,
  onClose,
  mealType,
  onCreatePress,
  onBarcodeScanPress,
  onFoodSelect,
}: FoodSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const headerRight = (
    <Pressable onPress={onCreatePress}>
      <Text className="text-sm font-semibold text-accent-secondary">+ Create Meal</Text>
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={`Add to ${mealType}`}
      headerRight={headerRight}
      scrollable={false}>
      <View className="flex-1 bg-bg-primary">
        {/* Search Bar */}
        <View className="border-b border-border-light bg-bg-primary px-4 pb-2">
          <View className="relative">
            <View
              className="absolute inset-y-0 left-0 z-10 items-center justify-center pl-3.5"
              pointerEvents="none">
              <Search
                size={theme.iconSize.md}
                color={searchQuery ? theme.colors.accent.secondary : theme.colors.text.secondary}
              />
            </View>
            <TextInput
              placeholder={`Search for food (e.g. 'Oats')`}
              placeholderTextColor={theme.colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="w-full rounded-2xl border border-border-light bg-bg-overlay py-3.5 pl-11 pr-10 text-base text-text-primary"
              style={{
                backgroundColor: theme.colors.background.cardDark,
                borderColor: searchQuery
                  ? `${theme.colors.accent.secondary}50`
                  : theme.colors.border.light,
              }}
              autoFocus
            />
            <Pressable
              className="absolute inset-y-0 right-0 items-center justify-center pr-2"
              onPress={onBarcodeScanPress}>
              <View className="rounded-lg p-1.5">
                <QrCode size={22} color={theme.colors.text.secondary} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="border-b border-border-light bg-bg-primary">
          <UnderlineTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
          />
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 bg-bg-primary"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ backgroundColor: theme.colors.background.primary }}>
          <View className="gap-4 p-4 pb-20">
            {/* Recent History Section */}
            <View>
              <SectionHeader
                title="Recent History"
                rightAction={{
                  label: 'View All',
                  onPress: () => {
                    // Handle view all
                  },
                }}
              />
              <View className="gap-1.5">
                {RECENT_HISTORY.map((food) => (
                  <FoodItemCard key={food.id} food={food} onAddPress={() => onFoodSelect?.(food)} />
                ))}
              </View>
            </View>

            {/* Common Foods Section */}
            <View>
              <SectionHeader title="Common Breakfast Foods" icon={Sparkles} />
              <View className="gap-1.5">
                {COMMON_FOODS.map((food) => (
                  <FoodItemCard key={food.id} food={food} onAddPress={() => onFoodSelect?.(food)} />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </FullScreenModal>
  );
}
