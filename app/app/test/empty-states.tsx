import { ArrowLeft, Dumbbell, Settings, UtensilsCrossed, WifiOff } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { ProgressIndicator } from '@/components/theme/ProgressIndicator';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';

import { TestSection } from './components/TestSection';

export default function EmptyStatesTestScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView className="bg-bg-primary flex-1" edges={['top']}>
      {/* Header */}
      <View className="bg-bg-primary/90 flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.background.white10 }}
        >
          <ArrowLeft size={theme.iconSize.xl} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="text-text-primary flex-1 text-center text-lg leading-tight font-bold tracking-tight">
          System Specs
        </Text>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <Settings size={theme.iconSize.lg} color={theme.colors.accent.primary} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pt-6 pb-2">
          <Text
            className="text-text-primary leading-tight font-extrabold tracking-tight"
            style={{ fontSize: theme.typography.fontSize['3xl'] }}
          >
            System States
          </Text>
          <Text className="text-text-secondary pt-3 text-base leading-relaxed font-normal">
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
            <View
              className="bg-bg-card flex-col gap-4 rounded-lg border p-4"
              style={{ borderColor: theme.colors.background.white5 }}
            >
              <View className="flex-row items-center gap-3">
                <SkeletonLoader
                  width={theme.size['12']}
                  height={theme.size['12']}
                  borderRadius={theme.borderRadius.md}
                />
                <View className="flex-1 gap-2">
                  <SkeletonLoader width="75%" height={theme.size['4']} />
                  <SkeletonLoader width="50%" height={theme.size['3']} />
                </View>
              </View>
              <View className="flex-row gap-2">
                <SkeletonLoader
                  width={theme.size['20']}
                  height={theme.size['8']}
                  borderRadius={theme.borderRadius.lg}
                />
                <SkeletonLoader
                  width={theme.size['20']}
                  height={theme.size['8']}
                  borderRadius={theme.borderRadius.lg}
                />
              </View>
            </View>

            {/* Food Item Skeleton */}
            <View
              className="bg-bg-card flex-row items-center justify-between rounded-lg border p-4"
              style={{ borderColor: theme.colors.background.white5 }}
            >
              <View className="flex-row items-center gap-3">
                <SkeletonLoader
                  width={theme.size['10']}
                  height={theme.size['10']}
                  borderRadius={theme.borderRadius.xl}
                />
                <View className="gap-1">
                  <SkeletonLoader width={theme.size['96']} height={theme.size['4']} />
                  <SkeletonLoader width={theme.size['16']} height={theme.size['3']} />
                </View>
              </View>
              <SkeletonLoader width={theme.size['12']} height={theme.size['4']} />
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
