import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Plus, Trash2, RefreshCw, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../theme';
import { MasterLayout } from '../../components/MasterLayout';
import { database, Exercise } from '../../database';
import { Q } from '@nozbe/watermelondb';

// All app screens for navigation
const APP_SCREENS = [
  { name: 'Home', route: '/', category: 'Main' },
  { name: 'Food', route: '/food', category: 'Main' },
  { name: 'Workouts', route: '/workouts', category: 'Main' },
  { name: 'Profile', route: '/profile', category: 'Main' },
  { name: 'Workout Session', route: '/workout-session', category: 'Workout' },
  { name: 'Workout Summary', route: '/workout-summary', category: 'Workout' },
  { name: 'Create Workout', route: '/create-workout', category: 'Workout' },
  { name: 'Rest Timer', route: '/rest-timer', category: 'Workout' },
  { name: 'Rest Over', route: '/rest-over', category: 'Workout' },
  { name: 'Test: Buttons', route: '/test/buttons', category: 'Test' },
  { name: 'Test: Cards', route: '/test/cards', category: 'Test' },
  { name: 'Test: Empty States', route: '/test/empty-states', category: 'Test' },
  { name: 'Test: Inputs', route: '/test/inputs', category: 'Test' },
  { name: 'Test: Modals', route: '/test/modals', category: 'Test' },
  { name: 'Test: Snackbar', route: '/test/snackbar', category: 'Test' },
];

export default function DatabaseTestScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch exercises manually
  const fetchExercises = async () => {
    setLoading(true);
    try {
      const exerciseCollection = database.get<Exercise>('exercises');
      const allExercises = await exerciseCollection.query().fetch();
      setExercises(allExercises);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  const addExercise = async () => {
    if (!name || !muscleGroup) return;

    try {
      await database.write(async () => {
        await database.get<Exercise>('exercises').create((exercise) => {
          exercise.name = name;
          exercise.muscleGroup = muscleGroup;
        });
      });
      setName('');
      setMuscleGroup('');
      fetchExercises();
    } catch (error) {
      console.error('Error adding exercise:', error);
    }
  };

  const deleteExercise = async (exercise: Exercise) => {
    try {
      await database.write(async () => {
        await exercise.markAsDeleted(); // WatermelonDB uses soft delete by default or sync-friendly delete
        // For permanent delete without sync: await exercise.destroyPermanently()
      });
      fetchExercises();
    } catch (error) {
      console.error('Error deleting exercise:', error);
    }
  };

  const clearAll = async () => {
    try {
      await database.write(async () => {
        const exerciseCollection = database.get<Exercise>('exercises');
        const all = await exerciseCollection.query().fetch();
        for (const exercise of all) {
          await exercise.destroyPermanently();
        }
      });
      fetchExercises();
    } catch (error) {
      console.error('Error clearing exercises:', error);
    }
  };

  // Group screens by category
  const screensByCategory = APP_SCREENS.reduce(
    (acc, screen) => {
      if (!acc[screen.category]) {
        acc[screen.category] = [];
      }
      acc[screen.category].push(screen);
      return acc;
    },
    {} as Record<string, typeof APP_SCREENS>
  );

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-6 p-4">
          <View>
            <Text className="mb-2 text-2xl font-bold text-text-primary">Database Test</Text>
            <Text className="text-text-secondary">Verify WatermelonDB Read/Write</Text>
          </View>

          {/* Navigation Links Section */}
          <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 text-lg font-bold text-text-primary">App Navigation</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Quick links to all screens for debugging
            </Text>

            {Object.entries(screensByCategory).map(([category, screens]) => (
              <View key={category} className="mb-4">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  {category}
                </Text>
                <View className="gap-2">
                  {screens.map((screen) => (
                    <Pressable
                      key={screen.route}
                      className="flex-row items-center justify-between rounded-lg border border-border-light bg-bg-primary p-3"
                      onPress={() => router.push(screen.route as any)}>
                      <Text className="flex-1 text-base font-medium text-text-primary">
                        {screen.name}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs text-text-tertiary">{screen.route}</Text>
                        <ArrowRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Form */}
          <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View>
              <Text className="mb-1 text-xs font-bold uppercase text-text-tertiary">
                Exercise Name
              </Text>
              <TextInput
                className="rounded-lg border border-border-light bg-bg-primary p-3 text-text-primary"
                placeholder="e.g. Bench Press"
                placeholderTextColor={theme.colors.text.tertiary}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View>
              <Text className="mb-1 text-xs font-bold uppercase text-text-tertiary">
                Muscle Group
              </Text>
              <TextInput
                className="rounded-lg border border-border-light bg-bg-primary p-3 text-text-primary"
                placeholder="e.g. Chest"
                placeholderTextColor={theme.colors.text.tertiary}
                value={muscleGroup}
                onChangeText={setMuscleGroup}
              />
            </View>
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-lg bg-accent-primary p-4"
              onPress={addExercise}>
              <Plus size={theme.iconSize.lg} color={theme.colors.text.black} />
              <Text className="font-bold text-text-black">Add Exercise</Text>
            </Pressable>
          </View>

          {/* List Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-text-primary">Exercises</Text>
              <Text className="rounded-full bg-bg-overlay px-2 py-0.5 text-xs text-text-secondary">
                {exercises.length}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable onPress={fetchExercises} className="p-2">
                <RefreshCw size={theme.iconSize.lg} color={theme.colors.text.secondary} />
              </Pressable>
              <Pressable onPress={clearAll} className="p-2">
                <Trash2 size={theme.iconSize.lg} color={theme.colors.status.error} />
              </Pressable>
            </View>
          </View>

          {/* List */}
          <View className="gap-3">
            {loading ? (
              <Text className="py-8 text-center text-text-tertiary">Loading...</Text>
            ) : exercises.length === 0 ? (
              <Text className="py-8 text-center text-text-tertiary">
                No exercises found in database.
              </Text>
            ) : (
              exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  className="flex-row items-center justify-between rounded-xl border border-border-accent bg-bg-overlay p-4">
                  <View>
                    <Text className="text-lg font-bold text-text-primary">{exercise.name}</Text>
                    <Text className="text-sm text-text-secondary">{exercise.muscleGroup}</Text>
                  </View>
                  <Pressable onPress={() => deleteExercise(exercise)}>
                    <Trash2 size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
