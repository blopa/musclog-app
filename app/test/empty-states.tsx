import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Settings , Dumbbell, UtensilsCrossed, WifiOff } from 'lucide-react-native';
import { TestSection } from './components/TestSection';
import { EmptyStateCard } from '../../components/theme/EmptyStateCard';
import { SkeletonLoader } from '../../components/theme/SkeletonLoader';
import { ProgressIndicator } from '../../components/theme/ProgressIndicator';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { theme } from '../../theme';

export default function EmptyStatesTestScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-bg-primary/90 px-4 pb-2 pt-4">
        <Pressable className="h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
          System Specs
        </Text>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <Settings size={20} color={theme.colors.accent.primary} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pb-2 pt-6">
          <Text className="text-[32px] font-extrabold leading-tight tracking-tight text-text-primary">
            System States
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Empty states, loading indicators, and error feedback patterns for the Musclog app.
          </Text>
        </View>

        <View className="h-8" />

        {/* Empty States Section */}
        <TestSection title="Empty States" subtitle="No data available">
          <View className="gap-4">
            <EmptyStateCard
              icon={Dumbbell}
              title="No Workouts Yet"
              description="Your fitness journey starts with your first rep. Plan your routine and track your progress here."
              buttonLabel="Create Your First Workout"
              iconGradient={true}
              buttonVariant="gradientCta"
              onButtonPress={() => console.log('Create workout')}
            />
            <EmptyStateCard
              icon={UtensilsCrossed}
              title="No Food Logged"
              description="Log your meals to stay on top of your nutrition goals. Your body will thank you."
              buttonLabel="Log Your Meal"
              buttonVariant="secondary"
              onButtonPress={() => console.log('Log meal')}
            />
          </View>
        </TestSection>

        {/* Loading Indicators Section */}
        <TestSection title="Loading Indicators" subtitle="Skeleton Loaders">
          <View className="gap-4">
            {/* Workout Card Skeleton */}
            <View className="flex-col gap-4 rounded-lg border border-white/5 bg-bg-card p-4">
              <View className="flex-row items-center gap-3">
                <SkeletonLoader width={48} height={48} borderRadius={12} />
                <View className="flex-1 gap-2">
                  <SkeletonLoader width="75%" height={16} />
                  <SkeletonLoader width="50%" height={12} />
                </View>
              </View>
              <View className="flex-row gap-2">
                <SkeletonLoader width={80} height={32} borderRadius={16} />
                <SkeletonLoader width={80} height={32} borderRadius={16} />
              </View>
            </View>

            {/* Food Item Skeleton */}
            <View className="flex-row items-center justify-between rounded-lg border border-white/5 bg-bg-card p-4">
              <View className="flex-row items-center gap-3">
                <SkeletonLoader width={40} height={40} borderRadius={20} />
                <View className="gap-1">
                  <SkeletonLoader width={96} height={16} />
                  <SkeletonLoader width={64} height={12} />
                </View>
              </View>
              <SkeletonLoader width={48} height={16} />
            </View>
          </View>
        </TestSection>

        <TestSection title="" subtitle="Progress Indicators">
          <ProgressIndicator message="Syncing with HealthKit..." />
        </TestSection>

        {/* Feedback & Errors Section */}
        <TestSection title="Feedback & Errors" subtitle="Error states">
          <ErrorStateCard
            icon={WifiOff}
            title="Connection Timeout"
            description="We couldn't reach the Musclog servers. Please check your internet connection."
            buttonLabel="Try Again"
            onButtonPress={() => console.log('Retry connection')}
          />
        </TestSection>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
