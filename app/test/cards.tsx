import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Bell, Trophy, Activity, Zap } from 'lucide-react-native';
import { TestSection } from './components/TestSection';
import { FeaturedWorkoutCard } from '../../components/FeaturedWorkoutCard';
import { DailySummaryCard } from '../../components/DailySummaryCard';
import { RecentWorkoutsCard } from '../../components/RecentWorkoutsCard';
import { WorkoutStatCard } from '../../components/WorkoutStatCard';
import { CaloriesRemainingCard } from '../../components/CaloriesRemainingCard';
import { CreateTemplateButton } from '../../components/CreateTemplateButton';
import { WorkoutCard } from '../../components/WorkoutCard';
import { FoodInfoCard } from '../../components/FoodInfoCard';
import { NotificationCard } from '../../components/NotificationCard';
import { MacroCard } from '../../components/MacroCard';
import { UpNextExerciseCard } from '../../components/UpNextExerciseCard';
import { FoodItemCard } from '../../components/FoodItemCard';
import { WorkoutSummaryStatsCard } from '../../components/WorkoutSummaryStatsCard';
import { StatCard } from '../../components/StatCard';
import { theme } from '../../theme';

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
          <Text className="text-[32px] font-extrabold leading-tight tracking-tight text-text-primary">
            Card Components
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Comprehensive card patterns for the Musclog app, showcasing various designs and use
            cases.
          </Text>
        </View>

        <View className="h-8" />

        <TestSection title="Featured Workout" subtitle="Highlight your workouts">
          <FeaturedWorkoutCard
            name="Push Day"
            lastCompleted="2026-01-08"
            exerciseCount={5}
            duration="45 mins"
            image={{ uri: 'https://example.com/workout-image.jpg' }}
          />
        </TestSection>

        <TestSection title="Daily Summary" subtitle="Track your daily progress">
          <DailySummaryCard
            calories={{ consumed: 1800, remaining: 400, goal: 2200 }}
            activity={{ minutes: 45, goal: 60 }}
            gradientColors={['#4f46e5', '#29e08e']}
          />
        </TestSection>

        <TestSection title="Recent Workouts" subtitle="Overview of recent activities">
          <RecentWorkoutsCard
            name="Leg Day"
            date="2026-01-07"
            duration="60 mins"
            calories={500}
            prs={3}
            image={{ uri: 'https://example.com/leg-day.jpg' }}
            imageBgColor="#11211a"
          />
        </TestSection>

        <TestSection title="Workout Stats" subtitle="Detailed workout statistics">
          <WorkoutStatCard title="Total Workouts" value={120} />
        </TestSection>

        <TestSection title="Calories Remaining" subtitle="Monitor your calorie goals">
          <CaloriesRemainingCard
            calories={{ remaining: 1800, total: 2200, percentage: 82 }}
            macros={{
              protein: {
                percentage: 40,
                amount: '120g',
                color: '#29e08e',
                progressColor: '#4f46e5',
              },
              carbs: {
                percentage: 50,
                amount: '200g',
                color: '#4f46e5',
                progressColor: '#29e08e',
              },
              fat: {
                percentage: 10,
                amount: '50g',
                color: '#e53e3e',
                progressColor: '#e53e3e',
              },
            }}
          />
        </TestSection>

        <TestSection title="Create Template" subtitle="Design your workout templates">
          <CreateTemplateButton onPress={() => console.log('Template created')} />
        </TestSection>

        <TestSection title="Workout Card" subtitle="Standard workout display">
          <WorkoutCard
            name="Pull Day B"
            lastCompleted="2 days ago"
            exerciseCount={6}
            duration="50 mins"
            image={require('../../assets/icon.png')}
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
              icon={<Sparkles size={24} color={theme.colors.accent.primary} />}
              iconBg={theme.colors.accent.primary10}
              title="AI Workout Suggestion"
              description="Based on your progress, we recommend adding 2 more sets to your bench press."
              time="2 hours ago"
              unread={true}
            />
            <NotificationCard
              type="workout-reminder"
              icon={<Bell size={24} color={theme.colors.status.info} />}
              iconBg="rgba(59, 130, 246, 0.1)"
              title="Workout Reminder"
              description="Don't forget your Push Day workout scheduled for today at 6:00 PM"
              time="5 hours ago"
              hasAction={true}
              onActionPress={() => console.log('Start workout')}
            />
            <NotificationCard
              type="workout-completed"
              icon={<Trophy size={24} color={theme.colors.status.warning} />}
              iconBg="rgba(249, 115, 22, 0.1)"
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
              color={theme.colors.macros.protein.text}
              progressColor={theme.colors.macros.protein.bg}
            />
            <MacroCard
              name="Carbs"
              percentage={45}
              amount="200g"
              color={theme.colors.macros.carbs.text}
              progressColor={theme.colors.macros.carbs.bg}
            />
            <MacroCard
              name="Fat"
              percentage={15}
              amount="50g"
              color={theme.colors.macros.fat.text}
              progressColor={theme.colors.macros.fat.bg}
            />
          </View>
        </TestSection>

        <TestSection title="Up Next Exercise" subtitle="Next exercise preview">
          <UpNextExerciseCard
            exercise={{
              name: 'Barbell Bench Press',
              weight: 80,
              reps: 8,
              sets: 4,
              image: require('../../assets/icon.png'),
            }}
            onPress={() => console.log('Exercise pressed')}
          />
        </TestSection>

        <TestSection title="Food Item" subtitle="Food list item">
          <FoodItemCard
            name="Grilled Salmon"
            description="Atlantic salmon with lemon and herbs"
            calories={280}
            image={require('../../assets/icon.png')}
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

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
