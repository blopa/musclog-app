import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Search, MoreVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AddMealModal } from '../../components/modals/AddMealModal';
import { CreateMealModal } from '../../components/modals/CreateMealModal';
import { theme } from '../../theme';
import { MasterLayout } from '../../components/MasterLayout';
import { FilterTabs } from '../../components/FilterTabs';
import { MealItemCard } from '../../components/cards/MealItemCard';

const MEALS_DATA = [
  {
    id: '1',
    title: 'Chicken & Rice Bowl',
    tags: ['High Protein', 'Lunch'],
    calories: 650,
    macros: {
      protein: '45g',
      carbs: '60g',
      fat: '18g',
    },
    image: require('../../assets/icon.png'), // Replace with actual meal image
  },
  {
    id: '2',
    title: 'Oatmeal & Berries',
    tags: ['Vegetarian', 'Breakfast'],
    calories: 350,
    macros: {
      protein: '12g',
      carbs: '55g',
      fat: '6g',
    },
    image: require('../../assets/icon.png'),
  },
  {
    id: '3',
    title: 'Salmon Salad',
    tags: ['Keto Friendly', 'Dinner'],
    calories: 520,
    macros: {
      protein: '35g',
      carbs: '15g',
      fat: '32g',
    },
    image: require('../../assets/icon.png'),
  },
  {
    id: '4',
    title: 'Avocado Toast & Egg',
    tags: ['Vegetarian', 'Breakfast'],
    calories: 410,
    macros: {
      protein: '14g',
      carbs: '35g',
      fat: '22g',
    },
    image: require('../../assets/icon.png'),
  },
];

export default function MyMealsScreen() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all');

  const FILTER_TABS = [
    { id: 'all', label: t('meals.filters.all') },
    { id: 'high-protein', label: t('meals.filters.highProtein') },
    { id: 'breakfast', label: t('meals.filters.breakfast') },
    { id: 'lunch', label: t('meals.filters.lunch') },
  ];
  const [searchQuery, setSearchQuery] = useState('');
  const [addMealModalVisible, setAddMealModalVisible] = useState(false);
  const [createMealModalVisible, setCreateMealModalVisible] = useState(false);

  // Handlers for AddMealModal options
  const handleCreateMeal = () => {
    setAddMealModalVisible(false);
    setTimeout(() => setCreateMealModalVisible(true), 300); // Wait for modal close animation
  };

  const handleGenerateMealAI = () => {
    setAddMealModalVisible(false);
    // TODO: Implement generate meal with AI logic
    console.log('Generate Meal with AI pressed');
  };

  const handleManageCategories = () => {
    setAddMealModalVisible(false);
    // TODO: Implement manage categories logic
    console.log('Manage Categories pressed');
  };

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <Text
            style={{
              fontSize: theme.typography.fontSize['4xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
            }}>
            {t('meals.title')}
          </Text>
          <View className="flex-row gap-4">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.background.white5 }}>
              <Search size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.background.white5 }}
              onPress={() => setAddMealModalVisible(true)}>
              <MoreVertical size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="mb-6">
          <FilterTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
            scrollViewContentContainerStyle={{ paddingHorizontal: 24 }}
          />
        </View>

        {/* Meal List */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
          {MEALS_DATA.map((meal) => (
            <MealItemCard
              key={meal.id}
              title={meal.title}
              tags={meal.tags}
              calories={meal.calories}
              macros={meal.macros}
              image={meal.image}
              onTrackPress={() => console.log('Track meal:', meal.title)}
            />
          ))}
          {/* Bottom spacing for FAB and TabBar */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* AddMealModal */}
        <AddMealModal
          visible={addMealModalVisible}
          onClose={() => setAddMealModalVisible(false)}
          onCreateMeal={handleCreateMeal}
          onGenerateMealAI={handleGenerateMealAI}
          onManageCategories={handleManageCategories}
        />
        {/* CreateMealModal */}
        <CreateMealModal
          visible={createMealModalVisible}
          onClose={() => setCreateMealModalVisible(false)}
        />
      </View>
    </MasterLayout>
  );
}
