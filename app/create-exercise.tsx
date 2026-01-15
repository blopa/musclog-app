import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera, Link, ChevronDown, Dumbbell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { TextInput } from '../components/theme/TextInput';
import { Button } from '../components/theme/Button';
import { GenericCard } from '../components/cards/GenericCard';
import { BottomPopUpMenu } from '../components/BottomPopUpMenu';

const PRIMARY_MUSCLES = [
  { value: 'chest', label: 'Chest' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
];

const SECONDARY_MUSCLES = [
  { value: 'triceps', label: 'Triceps' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'abs', label: 'Abs' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'traps', label: 'Traps' },
  { value: 'glutes', label: 'Glutes' },
];

export default function CreateExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exerciseName, setExerciseName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(['abs', 'traps']);
  const [isBodyweightOnly, setIsBodyweightOnly] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: isBodyweightOnly ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isBodyweightOnly]);

  const handleBack = () => {
    router.back();
  };

  const handleCreateExercise = () => {
    // TODO: Implement create exercise logic
    console.log('Create exercise', {
      exerciseName,
      primaryMuscle,
      secondaryMuscles,
      isBodyweightOnly,
    });
  };

  const handleUploadImage = () => {
    // TODO: Implement image upload
    console.log('Upload image');
  };

  const handleVideoURL = () => {
    // TODO: Implement video URL input
    console.log('Video URL');
  };

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    );
  };

  const handleSelectPrimaryMuscle = (muscle: string) => {
    setPrimaryMuscle(muscle);
    setIsPickerVisible(false);
  };

  const primaryMuscleLabel = primaryMuscle
    ? PRIMARY_MUSCLES.find((m) => m.value === primaryMuscle)?.label || 'Select primary muscle'
    : 'Select primary muscle';

  const pickerMenuItems = PRIMARY_MUSCLES.map((muscle) => ({
    icon: Dumbbell,
    iconColor: theme.colors.text.primary,
    iconBgColor: theme.colors.text.primary20,
    title: muscle.label,
    description: '',
    onPress: () => handleSelectPrimaryMuscle(muscle.value),
  }));

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
      {/* Top Navigation */}
      <View
        className="flex-row items-center px-4"
        style={{
          paddingTop: insets.top,
          paddingBottom: 16,
          backgroundColor: theme.colors.background.primary,
        }}>
        <Pressable
          onPress={handleBack}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <ChevronLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="flex-1 pr-10 text-center text-lg font-bold text-text-primary">
          Create Custom Exercise
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-2" style={{ gap: 24 }}>
          {/* Exercise Name */}
          <View>
            <TextInput
              label="Exercise Name"
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder="e.g. Incline Dumbbell Press"
            />
          </View>

          {/* Muscle Target Section */}
          <View style={{ gap: 16 }}>
            <Text className="text-lg font-bold tracking-tight text-text-primary">
              Muscle Target
            </Text>

            {/* Primary Muscle Group */}
            <View>
              <Pressable onPress={() => setIsPickerVisible(true)}>
                <View className="flex-col gap-2">
                  <Text className="ml-1 text-sm font-medium text-text-secondary">
                    Primary Muscle Group
                  </Text>
                  <View className="h-14 w-full flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card px-4">
                    <Text
                      className="font-medium"
                      style={{
                        color: primaryMuscle
                          ? theme.colors.text.primary
                          : theme.colors.text.tertiary,
                      }}>
                      {primaryMuscleLabel}
                    </Text>
                    <ChevronDown size={20} color={theme.colors.text.tertiary} />
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Secondary Muscles */}
            <View style={{ gap: 8 }}>
              <Text className="ml-1 text-sm font-medium text-text-secondary">
                Secondary Muscles
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SECONDARY_MUSCLES.map((muscle) => {
                  const isSelected = secondaryMuscles.includes(muscle.value);
                  return (
                    <Pressable
                      key={muscle.value}
                      onPress={() => toggleSecondaryMuscle(muscle.value)}
                      className="rounded-full border px-4 py-2"
                      style={{
                        backgroundColor: isSelected
                          ? theme.colors.accent.primary20
                          : theme.colors.background.overlay,
                        borderColor: isSelected
                          ? theme.colors.accent.primary + '80'
                          : 'transparent',
                      }}>
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary,
                          fontWeight: isSelected ? '600' : '500',
                        }}>
                        {muscle.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Settings Section */}
          <GenericCard variant="default">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-bold text-text-primary">Bodyweight Only</Text>
                <Text className="mt-0.5 text-xs text-text-secondary">
                  {"This exercise doesn't require equipment"}
                </Text>
              </View>
              <Pressable onPress={() => setIsBodyweightOnly(!isBodyweightOnly)}>
                <Animated.View
                  className="h-6 w-11 rounded-full"
                  style={{
                    backgroundColor: toggleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [theme.colors.background.overlay, theme.colors.accent.primary],
                    }),
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                  }}>
                  <Animated.View
                    className="h-5 w-5 rounded-full bg-white"
                    style={{
                      transform: [
                        {
                          translateX: toggleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 20],
                          }),
                        },
                      ],
                    }}
                  />
                </Animated.View>
              </Pressable>
            </View>
          </GenericCard>

          {/* Add Visuals Section */}
          <View style={{ gap: 12 }}>
            <Text className="text-lg font-bold tracking-tight text-text-primary">Add Visuals</Text>
            <View className="flex-row gap-4">
              <Pressable
                onPress={handleUploadImage}
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 bg-bg-card/30 p-4 active:border-accent-primary active:bg-accent-primary/5">
                <Camera size={24} color={theme.colors.text.tertiary} />
                <Text className="text-xs font-medium text-text-secondary">Upload Image</Text>
              </Pressable>
              <Pressable
                onPress={handleVideoURL}
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 bg-bg-card/30 p-4 active:border-accent-primary active:bg-accent-primary/5">
                <Link size={24} color={theme.colors.text.tertiary} />
                <Text className="text-xs font-medium text-text-secondary">Video URL</Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom spacing for fixed button */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        className="px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: 16,
          backgroundColor: theme.colors.background.primary,
        }}>
        <Button
          label="Create Exercise"
          onPress={handleCreateExercise}
          variant="gradientCta"
          size="md"
          width="full"
        />
      </View>

      {/* Primary Muscle Picker */}
      <BottomPopUpMenu
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        title="Primary Muscle Group"
        items={pickerMenuItems}
      />
    </View>
  );
}
