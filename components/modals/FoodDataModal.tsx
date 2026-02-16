import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput as RNTextInput, View } from 'react-native';

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

    return [
      {
        icon: MaterialIcons,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: 'Edit Food Entry',
        description: 'Modify the food details',
        onPress: () => {
          console.log('Edit food:', selectedFoodItem.name);
        },
      },
      {
        icon: MaterialIcons,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: 'Duplicate Entry',
        description: 'Create a copy of this entry',
        onPress: () => {
          console.log('Duplicate food:', selectedFoodItem.name);
        },
      },
      {
        icon: MaterialIcons,
        iconColor: theme.colors.status.error50,
        iconBgColor: 'rgba(239, 68, 68, 0.1)',
        title: 'Delete Entry',
        description: 'Remove this food entry',
        onPress: () => {
          console.log('Delete food:', selectedFoodItem.name);
        },
      },
    ];
  };

  const renderFoodItem = (item: FoodItem) => (
    <GenericCard key={item.id} variant="card" isPressable onPress={() => handleFoodItemPress(item)}>
      <View className="flex-row items-center p-4">
        <View className="flex flex-1 items-center gap-4">
          <View
            className="flex size-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.iconBgColor }}
          >
            <MaterialIcons name={item.icon} size={theme.iconSize.md} color={item.iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold leading-snug text-text-primary">
              {item.name}
            </Text>
            <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {item.calories} kcal • {item.protein}g Protein
            </Text>
          </View>
        </View>
        <Pressable
          className="flex size-8 items-center justify-center rounded-full active:opacity-70"
          onPress={() => handleFoodItemPress(item)}
        >
          <MaterialIcons
            name="more-vert"
            size={theme.iconSize.sm}
            color={theme.colors.text.tertiary}
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
        title="Manage Food Data"
        headerRight={renderHeaderRight()}
        scrollable
      >
        <View className="flex flex-col gap-4">
          {/* Search Bar */}
          <View className="relative">
            <View className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
              <MaterialIcons name="search" size={20} color={theme.colors.text.tertiary} />
            </View>
            <View
              className="w-full rounded-xl border-none bg-bg-card py-3.5 pl-11 pr-4"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.border.light,
                borderWidth: 1,
              }}
            >
              <RNTextInput
                className="text-sm font-medium text-text-primary"
                placeholder="Search food logs..."
                placeholderTextColor={theme.colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ color: theme.colors.text.primary }}
              />
            </View>
          </View>

          {/* Food List */}
          <View className="flex flex-col gap-4">
            {mockFoodData.map((dayData) => (
              <View key={dayData.date} className="flex flex-col gap-3">
                <View className="px-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                    {dayData.date}
                  </Text>
                </View>
                <View className="flex flex-col gap-3">{dayData.items.map(renderFoodItem)}</View>
              </View>
            ))}
          </View>

          {/* End of history indicator */}
          <View className="mt-8 flex flex-col items-center justify-center opacity-40">
            <MaterialIcons
              name="history"
              size={theme.iconSize['3xl']}
              color={theme.colors.text.tertiary}
            />
            <Text className="mt-2 text-sm font-medium text-text-tertiary">
              End of food log history
            </Text>
          </View>
        </View>
      </FullScreenModal>

      {/* Food Item Menu */}
      <BottomPopUpMenu
        visible={showFoodMenu}
        onClose={() => setShowFoodMenu(false)}
        title="Food Options"
        items={getFoodMenuItems()}
      />
    </>
  );
}
