import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TestSection } from './components/TestSection';
import { FeaturedWorkoutCard } from '../../components/FeaturedWorkoutCard';
import { DailySummaryCard } from '../../components/DailySummaryCard';
import { RecentWorkoutsCard } from '../../components/RecentWorkoutsCard';
import { WorkoutStatCard } from '../../components/WorkoutStatCard';
import { CaloriesRemainingCard } from '../../components/CaloriesRemainingCard';
import { CreateTemplateCard } from '../../components/CreateTemplateCard';

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
          <CreateTemplateCard onPress={() => console.log('Template created')} />
        </TestSection>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
