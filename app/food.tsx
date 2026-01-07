import { View, Text, ScrollView, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar, ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import i18n, { LOCALE_MAP, LanguageKeys } from '../lang/lang';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { CaloriesRemainingCard } from '../components/CaloriesRemainingCard';
import { FoodItemCard } from '../components/FoodItemCard';
import { MealSection } from '../components/MealSection';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { AICameraButton } from '../components/AICameraButton';
import { MoreFoodOptionsButton } from '../components/MoreFoodOptionsButton';
import { Button } from '../components/theme/Button';

const FOOD_DATA = {
  date: 'Today, Oct 24',
  calories: {
    remaining: 1250,
    total: 2500,
    percentage: 50,
  },
  macros: {
    protein: {
      percentage: 40,
      amount: '120g',
      color: theme.colors.macros.protein.text,
      progressColor: theme.colors.macros.protein.bg,
    },
    carbs: {
      percentage: 45,
      amount: '150g',
      color: theme.colors.macros.carbs.text,
      progressColor: theme.colors.macros.carbs.bg,
    },
    fat: {
      percentage: 25,
      amount: '60g',
      color: theme.colors.macros.fat.text,
      progressColor: theme.colors.macros.fat.bg,
    },
  },
  meals: {
    breakfast: {
      totalCalories: 350,
      items: [
        {
          id: '1',
          name: 'Oatmeal & Berries',
          description: '1 cup oats • 1/2 cup blueberries',
          calories: 350,
          image: require('../assets/icon.png'),
        },
        {
          id: '2',
          name: 'Orange Juice',
          description: '1 glass (250ml)',
          calories: 110,
          image: require('../assets/icon.png'),
        },
      ],
    },
    lunch: {
      totalCalories: 450,
      items: [
        {
          id: '3',
          name: 'Grilled Chicken Salad',
          description: '200g Chicken • Mixed Greens...',
          calories: 450,
          image: require('../assets/icon.png'),
        },
      ],
    },
  },
};

export default function FoodScreen() {
  const { t } = useTranslation();
  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];
  const today = new Date();
  const formattedDate = format(today, 'MMM d', { locale });

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        {/* Header with Date Navigation */}
        <View className="border-b border-border-dark bg-bg-primary">
          <View className="flex-row items-center justify-between px-4 py-4">
            <Pressable>
              <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-semibold text-text-primary">
                {t('food.header.today')}, {formattedDate}
              </Text>
              <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
            </View>
            <Pressable>
              <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pt-6">
            {/* Calories Remaining Card */}
            <CaloriesRemainingCard calories={FOOD_DATA.calories} macros={FOOD_DATA.macros} />

            {/* Scan Buttons */}
            <View className="gap-4">
              <View className="flex-row gap-4">
                <Button
                  label={t('food.actions.scanBarcode')}
                  icon={ScanLine}
                  variant="secondary"
                  size="md"
                  width="flex-1"
                  onPress={() => {
                    // Handle scan barcode action
                  }}
                />
                <AICameraButton
                  onPress={() => {
                    // Handle AI camera action
                  }}
                />
              </View>
              <MoreFoodOptionsButton
                onPress={() => {
                  // Handle more food options action
                }}
              />
            </View>

            {/* Breakfast Section */}
            <MealSection
              title={t('food.meals.breakfast')}
              totalCalories={FOOD_DATA.meals.breakfast.totalCalories}>
              {FOOD_DATA.meals.breakfast.items.map((item) => (
                <FoodItemCard
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  calories={item.calories}
                  image={item.image}
                />
              ))}
            </MealSection>

            {/* Lunch Section */}
            <MealSection
              title={t('food.meals.lunch')}
              totalCalories={FOOD_DATA.meals.lunch.totalCalories}>
              {FOOD_DATA.meals.lunch.items.map((item) => (
                <FoodItemCard
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  calories={item.calories}
                  image={item.image}
                />
              ))}
            </MealSection>

            {/* Bottom spacing for navigation */}
            <View className="h-32" />
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <FloatingActionButton position="right" bottom={120} />
      </View>
    </MasterLayout>
  );
}
