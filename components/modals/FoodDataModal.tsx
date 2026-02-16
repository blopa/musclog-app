import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput as RNTextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { FullScreenModal } from './FullScreenModal';

type FoodItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  iconBgColor: string;
};

type FoodDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

const mockFoodData: { date: string; items: FoodItem[] }[] = [
  {
    date: 'Today, Oct 24',
    items: [
      {
        id: '1',
        name: 'Grilled Chicken Breast',
        calories: 240,
        protein: 42,
        icon: 'restaurant',
        iconColor: '#29e08e',
        iconBgColor: 'rgba(41, 224, 142, 0.1)',
      },
      {
        id: '2',
        name: 'Boiled Eggs (2)',
        calories: 140,
        protein: 12,
        icon: 'egg',
        iconColor: '#6366f1',
        iconBgColor: 'rgba(99, 102, 241, 0.1)',
      },
    ],
  },
  {
    date: 'Yesterday, Oct 23',
    items: [
      {
        id: '3',
        name: 'Homemade Protein Pizza',
        calories: 580,
        protein: 35,
        icon: 'local-pizza',
        iconColor: '#f97316',
        iconBgColor: 'rgba(249, 115, 22, 0.1)',
      },
      {
        id: '4',
        name: 'Whey Isolate Shake',
        calories: 120,
        protein: 25,
        icon: 'fitness-center',
        iconColor: '#29e08e',
        iconBgColor: 'rgba(41, 224, 142, 0.1)',
      },
      {
        id: '5',
        name: 'Greek Yogurt w/ Berries',
        calories: 180,
        protein: 18,
        icon: 'restaurant-menu',
        iconColor: '#3b82f6',
        iconBgColor: 'rgba(59, 130, 246, 0.1)',
      },
    ],
  },
];

export function FoodDataModal({ visible, onClose }: FoodDataModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [showFoodMenu, setShowFoodMenu] = useState(false);

  const handleFoodItemPress = (item: FoodItem) => {
    setSelectedFoodItem(item);
    setShowFoodMenu(true);
  };

  const getFoodMenuItems = () => {
    if (!selectedFoodItem) {
      return [];
    }

    const EditIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="edit" {...props} />
    );
    const DuplicateIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="content-copy" {...props} />
    );
    const DeleteIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="delete" {...props} />
    );

    return [
      {
        icon: EditIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: t('food.manageFoodData.editFoodEntry'),
        description: t('food.manageFoodData.editFoodEntryDesc'),
        onPress: () => {
          console.log('Edit food:', selectedFoodItem.name);
        },
      },
      {
        icon: DuplicateIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: t('food.manageFoodData.duplicateEntry'),
        description: t('food.manageFoodData.duplicateEntryDesc'),
        onPress: () => {
          console.log('Duplicate food:', selectedFoodItem.name);
        },
      },
      {
        icon: DeleteIcon,
        iconColor: theme.colors.status.error50,
        iconBgColor: 'rgba(239, 68, 68, 0.1)',
        title: t('food.manageFoodData.deleteEntry'),
        description: t('food.manageFoodData.deleteEntryDesc'),
        onPress: () => {
          console.log('Delete food:', selectedFoodItem.name);
        },
      },
    ];
  };

  const renderFoodItem = (item: FoodItem) => (
    <GenericCard key={item.id} variant="card" isPressable onPress={() => handleFoodItemPress(item)}>
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-row items-center gap-4 flex-1">
          <View
            className="size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.iconBgColor }}
          >
            <MaterialIcons name={item.icon} size={20} color={item.iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold leading-snug text-text-primary">
              {item.name}
            </Text>
            <Text className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              {item.calories} kcal • {item.protein}g Protein
            </Text>
          </View>
        </View>
        <Pressable
          className="size-8 items-center justify-center rounded-full active:opacity-70"
          onPress={() => handleFoodItemPress(item)}
        >
          <MaterialIcons
            name="more-vert"
            size={20}
            color={theme.colors.text.secondary}
          />
        </Pressable>
      </View>
    </GenericCard>
  );

  const renderHeaderRight = () => (
    <Pressable
      className="flex size-10 items-center justify-center rounded-full active:bg-white/10"
      onPress={() => {
        console.log('More options pressed');
      }}
    >
      <MaterialIcons name="more-vert" size={theme.iconSize.md} color={theme.colors.text.primary} />
    </Pressable>
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('food.manageFoodData.title')}
        headerRight={renderHeaderRight()}
        scrollable
      >
        <ScrollView className="mt-6 flex flex-col gap-3 px-4">
          {/* Search Bar */}
          <View className="relative">
            <View className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
              <MaterialIcons name="search" size={20} color={theme.colors.text.tertiary} />
            </View>
            <View
              className="w-full rounded-xl bg-bg-card py-3 pl-12 pr-5"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.border.light,
                borderWidth: 1,
              }}
            >
              {/*TODO: dont use RNTextInput, use TextInput from theme*/}
              <RNTextInput
                className="text-base font-medium text-text-primary"
                placeholder={t('food.manageFoodData.searchPlaceholder')}
                placeholderTextColor={theme.colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ color: theme.colors.text.primary }}
              />
            </View>
          </View>

          {/* Food List */}
          <View className="mt-6 flex flex-col gap-3">
            {mockFoodData.map((dayData) => (
              <View key={dayData.date} className="flex flex-col gap-2">
                <View>
                  <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                    {dayData.date}
                  </Text>
                </View>
                <View className="flex flex-col gap-2">{dayData.items.map(renderFoodItem)}</View>
              </View>
            ))}
          </View>

          {/* End of history indicator */}
          <View className="mt-12 flex flex-col items-center justify-center opacity-40">
            <MaterialIcons name="history" size={48} color={theme.colors.text.tertiary} />
            <Text className="mt-2 text-sm font-medium text-text-tertiary">
              {t('food.manageFoodData.endOfHistory')}
            </Text>
          </View>
        </ScrollView>
      </FullScreenModal>

      {/* Food Item Menu */}
      <BottomPopUpMenu
        visible={showFoodMenu}
        onClose={() => setShowFoodMenu(false)}
        title={t('food.manageFoodData.foodOptions')}
        items={getFoodMenuItems()}
      />
    </>
  );
}
