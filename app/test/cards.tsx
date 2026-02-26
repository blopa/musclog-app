import {
  Activity,
  Bell,
  ChevronRight,
  Dumbbell,
  Heart,
  Moon,
  Repeat,
  Scale,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  Zap,
} from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaloriesRemainingCard } from '../../components/cards/CaloriesRemainingCard';
import { ChatWorkoutCard } from '../../components/cards/ChatWorkoutCard';
import { CurrentGoalsCard } from '../../components/cards/CurrentGoalsCard';
import { DailySummaryCard } from '../../components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '../../components/cards/DailySummaryCard/DailySummaryEmptyState';
import { DetailedItemCard } from '../../components/cards/DetailedItemCard';
import { FoodInfoCard } from '../../components/cards/FoodInfoCard';
import { FoodItemCard } from '../../components/cards/FoodItemCard';
import { GoalHistoryCard } from '../../components/cards/GoalHistoryCard';
import { HealthCategoryCard } from '../../components/cards/HealthCategoryCard';
import { MacroCard } from '../../components/cards/MacroCard';
import { MealItemCard } from '../../components/cards/MealItemCard';
import { NewWorkoutCard } from '../../components/cards/NewWorkoutCard';
import { NotificationCard } from '../../components/cards/NotificationCard';
import { SelectedExerciseCard } from '../../components/cards/SelectedExerciseCard';
import { SettingsCard } from '../../components/cards/SettingsCard';
import { StatCard } from '../../components/cards/StatCard';
import { WorkoutCard } from '../../components/cards/WorkoutCard';
import { WorkoutStatCard } from '../../components/cards/WorkoutStatCard';
import { WorkoutSummaryStatsCard } from '../../components/cards/WorkoutSummaryStatsCard';
import { UpNextLabel } from '../../components/UpNextLabel';
import { theme } from '../../theme';
import { TestSection } from './components/TestSection';

export default function CardsTestScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-bg-primary/90 px-4 pb-2 pt-4">
        <Text className="flex-1 text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
          Card Variants
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pb-2 pt-6">
          <Text
            className="font-extrabold leading-tight tracking-tight text-text-primary"
            style={{ fontSize: theme.typography.fontSize['3xl'] }}
          >
            Card Components
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Comprehensive card patterns for the Musclog app, showcasing various designs and use
            cases.
          </Text>
        </View>

        <View className="h-8" />

        <TestSection title="Featured Workout" subtitle="Highlight your workouts">
          <WorkoutCard
            name="Push Day"
            lastCompleted="2026-01-08"
            exerciseCount={5}
            duration="45 mins"
            variant="featured"
            onStart={() => console.log('Start workout')}
            onMore={() => console.log('More options')}
          />
        </TestSection>

        <TestSection title="Daily Summary" subtitle="Track your daily progress">
          <DailySummaryCard
            calories={{ consumed: 1800, remaining: 400, goal: 2200 }}
            macros={{
              protein: { value: 165, goal: 220 },
              carbs: { value: 250, goal: 220 },
              fats: { value: 73, goal: 73 },
            }}
          />
        </TestSection>

        <TestSection title="Daily Summary Empty State" subtitle="When no goals are set">
          <DailySummaryEmptyState onSetGoals={() => console.log('Set goals pressed')} />
        </TestSection>

        <TestSection title="Current Goals" subtitle="Display your current nutrition goals">
          <CurrentGoalsCard
            goal={{
              phase: 'cutting',
              calories: 2200,
              protein: 165,
              carbs: 220,
              fat: 73,
              targetWeight: 75,
              bodyFat: 15,
              ffmi: 22.5,
              bmi: 24.2,
              goalDate: '2026-03-15',
            }}
          />
        </TestSection>

        <TestSection title="Goal History" subtitle="Timeline of past goals">
          <GoalHistoryCard
            goal={{
              id: 1,
              dateRange: 'Jan 2024 - Mar 2024',
              phase: 'cutting',
              calories: 2000,
              protein: 150,
              carbs: 200,
              fat: 67,
              weight: 78,
              bodyFat: 18,
            }}
            isLast={false}
          />
          <GoalHistoryCard
            goal={{
              id: 2,
              dateRange: 'Apr 2024 - Jun 2024',
              phase: 'maintenance',
              calories: 2300,
              protein: 172,
              carbs: 230,
              fat: 77,
              weight: 75,
              bodyFat: 16,
            }}
            isLast={true}
          />
        </TestSection>

        <TestSection title="Workout Stats" subtitle="Detailed workout statistics">
          <WorkoutStatCard title="Total Workouts" value={120} />
        </TestSection>

        <TestSection title="Calories Remaining" subtitle="Monitor your calorie goals">
          <CaloriesRemainingCard
            calories={{ consumed: 1800, total: 2200, percentage: 82 }}
            macros={{
              protein: {
                percentage: 40,
                amount: '120g',
                goal: 150,
                color: theme.colors.status.emeraldLight,
                progressColor: theme.colors.status.indigo,
              },
              carbs: {
                percentage: 50,
                amount: '200g',
                goal: 250,
                color: theme.colors.status.indigo,
                progressColor: theme.colors.status.emeraldLight,
              },
              fat: {
                percentage: 10,
                amount: '50g',
                goal: 80,
                color: theme.colors.status.error,
                progressColor: theme.colors.status.error,
              },
            }}
          />
        </TestSection>

        <TestSection title="Workout Card" subtitle="Standard workout display">
          <WorkoutCard
            name="Pull Day B"
            lastCompleted="2 days ago"
            exerciseCount={6}
            duration="50 mins"
            variant="standard"
            onStart={() => console.log('Start workout')}
            onArchive={() => console.log('Archive workout')}
            onMore={() => console.log('More options')}
          />
        </TestSection>

        <TestSection title="Food Info" subtitle="Detailed food nutrition">
          <FoodInfoCard
            food={{
              name: 'Grilled Chicken Breast',
              category: 'Protein',
              calories: 231,
              protein: 43,
              carbs: 0,
              fat: 5,
            }}
          />
        </TestSection>

        <TestSection title="Notifications" subtitle="Various notification types">
          <View className="gap-4">
            <NotificationCard
              type="ai-insight"
              icon={<Sparkles size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconBg={theme.colors.accent.primary10}
              title="AI Workout Suggestion"
              description="Based on your progress, we recommend adding 2 more sets to your bench press."
              time="2 hours ago"
              unread={true}
            />
            <NotificationCard
              type="workout-reminder"
              icon={<Bell size={theme.iconSize.xl} color={theme.colors.status.info} />}
              iconBg={theme.colors.status.info10}
              title="Workout Reminder"
              description="Don't forget your Push Day workout scheduled for today at 6:00 PM"
              time="5 hours ago"
              hasAction={true}
              onActionPress={() => console.log('Start workout')}
            />
            <NotificationCard
              type="workout-completed"
              icon={<Trophy size={theme.iconSize.xl} color={theme.colors.status.warning} />}
              iconBg={theme.colors.status.warning10}
              title="Workout Completed!"
              description="Great job completing your Leg Day workout. You hit 3 personal records!"
              time="Yesterday"
            />
          </View>
        </TestSection>

        <TestSection title="Macro Cards" subtitle="Macro breakdown display">
          <View className="flex-row gap-3">
            <MacroCard
              name="Protein"
              percentage={40}
              amount="120g"
              goal={150}
              color={theme.colors.macros.protein.text}
              progressColor={theme.colors.macros.protein.bg}
            />
            <MacroCard
              name="Carbs"
              percentage={45}
              amount="200g"
              goal={250}
              color={theme.colors.macros.carbs.text}
              progressColor={theme.colors.macros.carbs.bg}
            />
            <MacroCard
              name="Fat"
              percentage={15}
              amount="50g"
              goal={80}
              color={theme.colors.macros.fat.text}
              progressColor={theme.colors.macros.fat.bg}
            />
          </View>
        </TestSection>

        <TestSection title="Up Next Exercise" subtitle="Next exercise preview">
          <DetailedItemCard
            item={{
              name: 'Barbell Bench Press',
              itemOne: { value: 80, icon: Dumbbell },
              itemTwo: { value: 10, icon: Repeat },
              itemThree: { value: '3x8', icon: ChevronRight },
              media: require('../../assets/icon.png'),
            }}
            onPress={() => console.log('Exercise pressed')}
            ctaLabel={<UpNextLabel />}
          />
        </TestSection>

        <TestSection title="Selected Exercise" subtitle="Currently selected exercise display">
          <SelectedExerciseCard
            exerciseName="Barbell Bench Press"
            exerciseCategory="Chest"
            exerciseType="Compound"
            onChange={() => console.log('Change exercise')}
          />
        </TestSection>

        <TestSection title="New Workout Card" subtitle="Add new workout options">
          <NewWorkoutCard
            variant="popular"
            icon={<Sparkles size={theme.iconSize.lg} color={theme.colors.text.white} />}
            title="Generate with AI"
            subtitle="Let Musclog build a personalized routine based on your goals and equipment."
            onPress={() => console.log('New workout pressed')}
          />
          <NewWorkoutCard
            icon={<Sparkles size={theme.iconSize.lg} color={theme.colors.text.white} />}
            title="Create New Workout"
            subtitle="Start from a template or build your own"
            onPress={() => console.log('New workout pressed')}
          />
        </TestSection>

        <TestSection title="Food Item" subtitle="Food list item with meal-specific icons">
          <FoodItemCard
            name="Pancakes with Syrup"
            description="Fluffy pancakes with maple syrup"
            calories={320}
            protein={8}
            carbs={45}
            fat={12}
            mealType="breakfast"
            onMorePress={() => console.log('More options')}
          />
          <FoodItemCard
            name="Caesar Salad"
            description="Fresh romaine lettuce with parmesan"
            calories={250}
            protein={15}
            carbs={12}
            fat={18}
            mealType="lunch"
            onMorePress={() => console.log('More options')}
          />
          <FoodItemCard
            name="Grilled Salmon"
            description="Atlantic salmon with lemon and herbs"
            calories={280}
            protein={35}
            carbs={0}
            fat={18}
            mealType="dinner"
            onMorePress={() => console.log('More options')}
          />
          <FoodItemCard
            name="Apple Slices"
            description="Fresh apple slices with peanut butter"
            calories={150}
            protein={4}
            carbs={20}
            fat={8}
            mealType="snack"
            onMorePress={() => console.log('More options')}
          />
          <FoodItemCard
            name="Protein Shake"
            description="Post-workout recovery shake"
            calories={200}
            protein={25}
            carbs={15}
            fat={3}
            mealType="other"
            onMorePress={() => console.log('More options')}
          />
        </TestSection>

        <TestSection title="Workout Summary Stats" subtitle="Post-workout statistics">
          <WorkoutSummaryStatsCard totalTime="45 min" volume="2,400 kg" personalRecords={3} />
        </TestSection>

        <TestSection title="Stat Card" subtitle="General statistics display">
          <View className="flex-row gap-3">
            <StatCard
              title="Total Volume"
              value="12,500"
              unit="kg"
              change="+5.2%"
              changeType="positive"
              icon={Activity}
              iconColor={theme.colors.accent.primary}
            />
            <StatCard
              title="Workouts"
              value="48"
              change="-2.1%"
              changeType="warning"
              icon={Zap}
              iconColor={theme.colors.status.warning}
            />
          </View>
        </TestSection>

        <TestSection title="Chat Workout" subtitle="Chat-based workout interactions">
          <ChatWorkoutCard
            title="Chat Workout"
            duration="30 mins"
            level="Intermediate"
            exerciseCount={5}
            calories={200}
            image={{ uri: 'https://via.placeholder.com/150' }}
            onStartWorkout={() => console.log('Start workout')}
          />
        </TestSection>

        <TestSection title="Meal Item" subtitle="Display meal details">
          <MealItemCard
            title="Breakfast"
            tags={['Healthy', 'Quick']}
            calories={350}
            macros={{ protein: '25g', carbs: '30g', fat: '10g' }}
            image={{ uri: 'https://via.placeholder.com/150' }}
            onTrackPress={() => console.log('Track meal')}
          />
        </TestSection>

        <TestSection title="Settings" subtitle="App settings overview">
          <SettingsCard
            icon={<Sparkles size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
            title="Settings"
            subtitle="Manage your app settings."
            onPress={() => console.log('Settings pressed')}
          />
        </TestSection>

        <TestSection title="Health Categories" subtitle="Test reusable health category cards">
          <View className="flex-row flex-wrap gap-3">
            <HealthCategoryCard
              icon={UtensilsCrossed}
              label="Nutrition"
              backgroundColor={theme.colors.status.indigo10}
              iconColor={theme.colors.status.indigoLight}
            />
            <HealthCategoryCard
              icon={Scale}
              label="Weight"
              backgroundColor={theme.colors.status.emerald20}
              iconColor={theme.colors.status.emeraldLight}
            />
            <HealthCategoryCard
              icon={Moon}
              label="Sleep"
              backgroundColor={theme.colors.status.emerald10}
              iconColor={theme.colors.status.emerald}
            />
            <HealthCategoryCard
              icon={Heart}
              label="Vitals"
              backgroundColor={theme.colors.status.purple10}
              iconColor={theme.colors.status.purple}
            />
          </View>
        </TestSection>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
