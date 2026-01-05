import { View, Text, ScrollView, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar, ScanLine, Grid3x3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import i18n, { LOCALE_MAP, LanguageKeys } from '../lang/lang';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { MacroCard } from '../components/MacroCard';
import { FoodItemCard } from '../components/FoodItemCard';
import { MealSection } from '../components/MealSection';
import { FloatingActionButton } from '../components/FloatingActionButton';

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
      color: 'text-indigo-400',
      progressColor: 'bg-indigo-500',
    },
    carbs: {
      percentage: 45,
      amount: '150g',
      color: 'text-emerald-400',
      progressColor: 'bg-emerald-400',
    },
    fat: {
      percentage: 25,
      amount: '60g',
      color: 'text-amber-400',
      progressColor: 'bg-amber-400',
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
            <LinearGradient
              colors={theme.colors.gradients.card}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-3xl border border-border-default p-6">
              <View className="mb-6">
                <Text className="mb-2 text-sm text-gray-400">{t('food.caloriesRemaining')}</Text>
                <View className="mb-1 flex-row items-baseline gap-2">
                  <Text className="text-6xl font-bold text-white">
                    {FOOD_DATA.calories.remaining.toLocaleString()}
                  </Text>
                  <Text className="text-2xl text-gray-400">
                    / {FOOD_DATA.calories.total.toLocaleString()}
                  </Text>
                  <Text className="ml-auto text-3xl font-semibold text-emerald-400">
                    {FOOD_DATA.calories.percentage}%
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View className="mb-6 h-3 overflow-hidden rounded-full bg-gray-800/50">
                <LinearGradient
                  colors={theme.colors.gradients.progress}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-full rounded-full"
                  style={{ width: `${FOOD_DATA.calories.percentage}%` }}
                />
              </View>

              {/* Macros */}
              <View className="flex-row gap-3">
                <MacroCard
                  name={t('food.macros.protein')}
                  percentage={FOOD_DATA.macros.protein.percentage}
                  amount={FOOD_DATA.macros.protein.amount}
                  color={FOOD_DATA.macros.protein.color}
                  progressColor={FOOD_DATA.macros.protein.progressColor}
                />
                <MacroCard
                  name={t('food.macros.carbs')}
                  percentage={FOOD_DATA.macros.carbs.percentage}
                  amount={FOOD_DATA.macros.carbs.amount}
                  color={FOOD_DATA.macros.carbs.color}
                  progressColor={FOOD_DATA.macros.carbs.progressColor}
                />
                <MacroCard
                  name={t('food.macros.fat')}
                  percentage={FOOD_DATA.macros.fat.percentage}
                  amount={FOOD_DATA.macros.fat.amount}
                  color={FOOD_DATA.macros.fat.color}
                  progressColor={FOOD_DATA.macros.fat.progressColor}
                />
              </View>
            </LinearGradient>

            {/* Scan Buttons */}
            <View className="flex-row gap-4">
              <Pressable className="flex-1 flex-row items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg-overlay py-4">
                <ScanLine size={theme.iconSize.md} color={theme.colors.accent.secondary} />
                <Text className="text-lg font-semibold text-text-primary">
                  {t('food.actions.scanBarcode')}
                </Text>
              </Pressable>

              <Pressable className="relative flex-1 flex-row items-center justify-center gap-3 rounded-2xl border border-emerald-900/30 py-4">
                <LinearGradient
                  colors={theme.colors.gradients.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0 rounded-2xl"
                />
                <Grid3x3 size={theme.iconSize.md} color={theme.colors.text.primary} />
                <Text className="text-lg font-semibold text-text-primary">
                  {t('food.actions.aiCamera')}
                </Text>
              </Pressable>
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
