import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  MoreVertical,
  Video,
  ChevronRight,
  Plus,
  Pencil,
  Copy,
  Share2,
  Trash2,
  Zap,
  Heart,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../components/BottomPopUpMenu';

// Mock data - replace with actual data from props or route params
const EXERCISE_DATA = {
  name: 'Incline Dumbbell Press',
  primaryMuscle: 'Chest',
  equipment: 'Dumbbell',
  mechanic: 'Compound',
  personalBest: { value: 85, unit: 'KG' },
  avgFrequency: { value: 2.4, unit: 'x / wk' },
  workouts: [
    {
      id: '1',
      name: 'Push Day Hypertrophy',
      subtitle: 'Last performed 2 days ago',
      iconGradient: ['#4f46e5', '#5b21b6'] as const, // indigo gradient
      icon: Zap,
    },
    {
      id: '2',
      name: 'Upper Body Blast',
      subtitle: 'Created on Oct 12, 2023',
      iconGradient: ['#10b981', '#0d9488'] as const, // emerald-teal gradient
      icon: Zap,
    },
    {
      id: '3',
      name: 'Full Body Foundation',
      subtitle: 'Used in 12 sessions',
      iconGradient: ['#ec4899', '#e11d48'] as const, // pink-rose gradient
      icon: Heart,
    },
  ],
};

export default function ViewExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // For now, using a placeholder image - replace with actual exercise image
  const backgroundImage = require('../assets/icon.png');

  const handleBack = () => {
    router.back();
  };

  const handleWatchTechnique = () => {
    // Navigate to technique video or open modal
    console.log('Watch technique');
  };

  const handleLogExercise = () => {
    // Navigate to log exercise screen
    console.log('Log exercise');
  };

  const handleWorkoutPress = (workoutId: string) => {
    // Navigate to workout detail
    console.log('Navigate to workout:', workoutId);
  };

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.accent.secondary, // Vibrant emerald/teal green
      iconBgColor: theme.colors.background.iconDarker, // Lighter shade of dark green
      title: 'Edit Exercise',
      description: 'Modify exercise details',
      onPress: () => {
        console.log('Edit exercise');
      },
    },
    {
      icon: Share2,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: 'Share',
      description: 'Share this exercise',
      onPress: () => {
        console.log('Share exercise');
      },
    },
    {
      icon: Copy,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: 'Duplicate',
      description: 'Create a copy of this exercise',
      onPress: () => {
        console.log('Duplicate exercise');
      },
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: 'Delete',
      description: 'Remove this exercise permanently',
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => {
        console.log('Delete exercise');
      },
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: '#1a2e2a' }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section with Background Image */}
        <View style={{ height: 384, overflow: 'hidden', position: 'relative' }}>
          {/* Background Image */}
          <Image
            source={backgroundImage}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              opacity: 0.6,
            }}
            resizeMode="cover"
          />

          {/* Top Navigation */}
          <View
            className="absolute left-0 right-0 top-0 flex-row items-center justify-between"
            style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, zIndex: 10 }}>
            <Pressable
              onPress={handleBack}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
              <ChevronLeft size={24} color="white" />
            </Pressable>
            <Pressable
              onPress={() => setIsMenuVisible(true)}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
              <MoreVertical size={20} color="white" />
            </Pressable>
          </View>

          {/* Content Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(26, 46, 42, 0.9)', '#1a2e2a']}
            locations={[0, 0.7, 1]}
            className="absolute bottom-0 left-0 right-0"
            style={{ padding: 24, zIndex: 5 }}>
            <Pressable
              onPress={handleWatchTechnique}
              className="mb-4 flex-row items-center justify-center rounded-full px-4 py-3"
              style={{ backgroundColor: '#1a3a2a' }}>
              <Video size={16} color="#34d399" fill="#34d399" />
              <Text className="ml-2 text-sm font-medium text-white">WATCH TECHNIQUE</Text>
            </Pressable>

            <Text className="mb-6 text-4xl font-bold text-white">{EXERCISE_DATA.name}</Text>

            {/* Tags */}
            <View className="mb-6 flex-row flex-wrap gap-3">
              <LinearGradient
                colors={['#2563eb', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="flex-row items-center gap-2 rounded-full px-4 py-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-white opacity-80">
                  Primary Muscle
                </Text>
                <Text className="font-bold text-white">{EXERCISE_DATA.primaryMuscle}</Text>
              </LinearGradient>
              <View
                className="flex-row items-center gap-2 rounded-full border px-4 py-2"
                style={{
                  backgroundColor: '#1a3a2a',
                  borderColor: '#374151',
                }}>
                <Text className="text-xs font-medium uppercase tracking-wide text-white opacity-80">
                  Equipment
                </Text>
                <Text className="font-bold text-white">{EXERCISE_DATA.equipment}</Text>
              </View>
              <View
                className="flex-row items-center gap-2 rounded-full border px-4 py-2"
                style={{
                  backgroundColor: '#1a3a2a',
                  borderColor: '#374151',
                }}>
                <Text className="text-xs font-medium uppercase tracking-wide text-white opacity-80">
                  Mechanic
                </Text>
                <Text className="font-bold text-white">{EXERCISE_DATA.mechanic}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View className="px-6 py-6" style={{ flexDirection: 'row', gap: 16 }}>
          <View
            className="flex-1 rounded-3xl border p-6"
            style={{
              backgroundColor: 'rgba(26, 58, 42, 0.5)',
              borderColor: 'rgba(55, 65, 81, 0.5)',
            }}>
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Personal Best
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-bold" style={{ color: '#34d399' }}>
                {EXERCISE_DATA.personalBest.value}
              </Text>
              <Text className="text-xl text-gray-400">{EXERCISE_DATA.personalBest.unit}</Text>
            </View>
          </View>
          <View
            className="flex-1 rounded-3xl border p-6"
            style={{
              backgroundColor: 'rgba(26, 58, 42, 0.5)',
              borderColor: 'rgba(55, 65, 81, 0.5)',
            }}>
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Avg. Frequency
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-bold" style={{ color: '#818cf8' }}>
                {EXERCISE_DATA.avgFrequency.value}
              </Text>
              <Text className="text-xl text-gray-400">{EXERCISE_DATA.avgFrequency.unit}</Text>
            </View>
          </View>
        </View>

        {/* Workouts Section */}
        <View className="px-6 py-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Workouts Using This</Text>
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: 'rgba(52, 211, 153, 0.2)' }}>
              <Text className="text-xs font-bold" style={{ color: '#34d399' }}>
                3 TEMPLATES
              </Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            {EXERCISE_DATA.workouts.map((workout) => (
              <Pressable
                key={workout.id}
                onPress={() => handleWorkoutPress(workout.id)}
                className="flex-row items-center gap-4 rounded-3xl border p-4"
                style={{
                  backgroundColor: 'rgba(26, 58, 42, 0.5)',
                  borderColor: 'rgba(55, 65, 81, 0.5)',
                }}>
                <LinearGradient
                  colors={workout.iconGradient}
                  className="h-16 w-16 items-center justify-center rounded-2xl">
                  <workout.icon
                    size={32}
                    color="white"
                    fill={workout.id === '2' ? 'white' : 'none'}
                  />
                </LinearGradient>
                <View className="flex-1">
                  <Text className="mb-1 text-lg font-bold text-white">{workout.name}</Text>
                  <Text className="text-sm text-gray-400">{workout.subtitle}</Text>
                </View>
                <ChevronRight size={20} color="#6b7280" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Bottom spacing for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View
        className="px-6"
        style={{
          paddingBottom: Math.max(insets.bottom, 32),
          paddingTop: 16,
        }}>
        <Pressable
          onPress={handleLogExercise}
          className="h-16 w-full flex-row items-center justify-center rounded-3xl">
          <LinearGradient
            colors={['#4f46e5', '#3b82f6', '#10b981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-full w-full flex-row items-center justify-center rounded-3xl">
            <Plus size={24} color="white" />
            <Text className="ml-2 text-lg font-bold text-white">Log This Exercise</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* More Options Menu */}
      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={EXERCISE_DATA.name}
        subtitle="Exercise Options"
        items={menuItems}
      />
    </View>
  );
}
