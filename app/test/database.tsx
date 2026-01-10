import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Plus, Trash2, RefreshCw } from 'lucide-react-native';
import { theme } from '../../theme';
import { MasterLayout } from '../../components/MasterLayout';
import { database, Exercise } from '../../database';
import { Q } from '@nozbe/watermelondb';

export default function DatabaseTestScreen() {
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
          exercise.isCustom = true;
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

  return (
    <MasterLayout>
      <View className="flex-1 gap-6 p-4">
        <View>
          <Text className="mb-2 text-2xl font-bold text-text-primary">Database Test</Text>
          <Text className="text-text-secondary">Verify WatermelonDB Read/Write</Text>
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
            <Plus size={20} color={theme.colors.text.black} />
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
              <RefreshCw size={20} color={theme.colors.text.secondary} />
            </Pressable>
            <Pressable onPress={clearAll} className="p-2">
              <Trash2 size={20} color={theme.colors.status.error} />
            </Pressable>
          </View>
        </View>

        {/* List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {loading ? (
            <Text className="py-8 text-center text-text-tertiary">Loading...</Text>
          ) : exercises.length === 0 ? (
            <Text className="py-8 text-center text-text-tertiary">
              No exercises found in database.
            </Text>
          ) : (
            <View className="gap-3">
              {exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  className="flex-row items-center justify-between rounded-xl border border-border-accent bg-bg-overlay p-4">
                  <View>
                    <Text className="text-lg font-bold text-text-primary">{exercise.name}</Text>
                    <Text className="text-sm text-text-secondary">{exercise.muscleGroup}</Text>
                  </View>
                  <Pressable onPress={() => deleteExercise(exercise)}>
                    <Trash2 size={20} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </MasterLayout>
  );
}
