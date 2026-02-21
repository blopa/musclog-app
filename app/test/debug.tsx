import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ArrowRight, ChevronRight, Database, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { MigrationSection } from '../../components/MigrationSection';
import { Button } from '../../components/theme/Button';
import { UNITS_SETTING_TYPE } from '../../constants/settings';
import { database, Exercise, Setting, User, UserMetric } from '../../database';
import type { MuscleGroup } from '../../database/models';
import { MigrationService, UserService } from '../../database/services';
import { useOldDatabaseMigration } from '../../hooks/useOldDatabaseMigration';
import { theme } from '../../theme';

// All app screens for navigation
const APP_SCREENS = [
  { name: 'Home', route: '/', category: 'Main' },
  { name: 'Profile', route: '/profile', category: 'Main' },
  { name: 'Food', route: '/nutrition/food', category: 'Nutrition' },
  { name: 'Meals', route: '/nutrition/meals', category: 'Nutrition' },
  { name: 'AI Camera', route: '/nutrition/ai-camera', category: 'Nutrition' },
  { name: 'Workouts', route: '/workout/workouts', category: 'Workout' },
  { name: 'Workout Session', route: '/workout/workout-session', category: 'Workout' },
  { name: 'Workout Summary', route: '/workout/workout-summary', category: 'Workout' },
  { name: 'Rest Timer', route: '/workout/rest-timer', category: 'Workout' },
  { name: 'Rest Over', route: '/workout/rest-over', category: 'Workout' },
  { name: 'Landing', route: '/onboarding/landing', category: 'Onboarding' },
  { name: 'Onboarding', route: '/onboarding/onboarding', category: 'Onboarding' },
  { name: 'Personal Info', route: '/onboarding/personal-info', category: 'Onboarding' },
  { name: 'Fitness Info', route: '/onboarding/fitness-info', category: 'Onboarding' },
  { name: 'Set Goals', route: '/onboarding/set-goals', category: 'Onboarding' },
  { name: 'Nutrition Goals', route: '/onboarding/nutrition-goals', category: 'Onboarding' },
  {
    name: 'Nutrition Goals Results',
    route: '/onboarding/nutrition-goals-results',
    category: 'Onboarding',
  },
  { name: 'Health Connect', route: '/onboarding/health-connect', category: 'Onboarding' },
  { name: 'Connect with Google', route: '/onboarding/connect-with-google', category: 'Onboarding' },
  { name: 'Test: Buttons', route: '/test/buttons', category: 'Test' },
  { name: 'Test: Cards', route: '/test/cards', category: 'Test' },
  { name: 'Test: Empty States', route: '/test/empty-states', category: 'Test' },
  { name: 'Test: Inputs', route: '/test/inputs', category: 'Test' },
  { name: 'Test: Modals', route: '/test/modals', category: 'Test' },
  { name: 'Test: Snackbar', route: '/test/snackbar', category: 'Test' },
];

export default function DebugTestScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserMetric[]>([]);
  const [tableSchemas, setTableSchemas] = useState<
    Record<string, { name: string; type: string; notnull: boolean; pk: boolean }[]>
  >({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const { checkMigrationData, migrationSummary, checkingOldDatabase } = useOldDatabaseMigration();
  const [migrationService] = useState(() => new MigrationService());

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

  // Fetch user data
  const fetchUserData = async () => {
    try {
      const currentUser = await UserService.getCurrentUser();
      setUser(currentUser);

      // Fetch settings
      const allSettings = await database
        .get<Setting>('settings')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch();
      setSettings(allSettings);

      // Fetch user metrics
      const allMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('date', Q.desc))
        .fetch();
      setUserMetrics(allMetrics);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchExercises();
      await fetchUserData();
      await checkMigrationData();
    };

    fetchData();
  }, [checkMigrationData]);

  const addExercise = async () => {
    if (!name || !muscleGroup) {
      return;
    }

    try {
      await database.write(async () => {
        await database.get<Exercise>('exercises').create((exercise) => {
          exercise.name = name;
          exercise.muscleGroup = muscleGroup as MuscleGroup;
        });
      });
      setName('');
      setMuscleGroup('');
      await fetchExercises();
    } catch (error) {
      console.error('Error adding exercise:', error);
    }
  };

  const deleteExercise = async (exercise: Exercise) => {
    try {
      // markAsDeleted is a @writer method, so it already manages its own write transaction
      // Do NOT wrap it in database.write() - that creates nested writers and blocks the queue
      await exercise.markAsDeleted();
      await fetchExercises();
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

  const deleteDatabase = async () => {
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      console.log('Database has been deleted and will be recreated on next app load.');
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  };

  const clearAsyncStorage = async () => {
    const existingEncryptionKey = await AsyncStorage.getItem('encryptionKey');

    try {
      await AsyncStorage.clear();
      console.log('AsyncStorage has been cleared successfully.');
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }

    if (existingEncryptionKey) {
      await AsyncStorage.setItem('encryptionKey', existingEncryptionKey);
    }
  };

  const checkOldDatabase = async () => {
    setTableSchemas({});
    setExpandedTables(new Set());

    try {
      if (!migrationSummary?.tables.length) {
        return;
      }

      // Get schema for each table using MigrationService
      const schemas: Record<
        string,
        { name: string; type: string; notnull: boolean; pk: boolean }[]
      > = {};

      for (const tableName of migrationSummary.tables) {
        try {
          // Use MigrationService to get table schema
          const pragmaResult = await migrationService.getTableSchema(tableName);
          schemas[tableName] = pragmaResult.map(
            (row: { name: string; type: string; notnull: boolean; pk: boolean }) => ({
              name: row.name,
              type: row.type,
              notnull: Boolean(row.notnull),
              pk: Boolean(row.pk),
            })
          );
        } catch (error) {
          console.error(`Error getting schema for table ${tableName}:`, error);
          schemas[tableName] = [];
        }
      }

      setTableSchemas(schemas);
      console.log('Old database tables:', migrationSummary.tables);
      console.log('Table schemas:', schemas);
    } catch (error) {
      console.error('Error checking old database:', error);
    }
  };

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
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
                      onPress={() => router.push(screen.route as any)}
                    >
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

          {/* Danger Zone */}
          <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 text-lg font-bold text-text-primary">Danger Zone</Text>
            <Button onPress={deleteDatabase} label="Delete Database" size="sm" variant="discard" />
            <Button
              onPress={clearAsyncStorage}
              label="Clear AsyncStorage"
              size="sm"
              variant="discard"
            />
          </View>

          {/* Old Database Checker */}
          <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="flex-row items-center gap-2">
              <Database size={theme.iconSize.lg} color={theme.colors.text.primary} />
              <Text className="text-lg font-bold text-text-primary">Old Database Checker</Text>
            </View>
            <Text className="text-sm text-text-secondary">
              Check if the old workoutLoggerDatabase.db exists and view its tables
            </Text>

            <Pressable
              className={`flex-row items-center justify-center gap-2 rounded-lg p-4 ${
                checkingOldDatabase ? 'bg-border-light' : 'bg-accent-primary'
              }`}
              onPress={checkOldDatabase}
              disabled={checkingOldDatabase}
            >
              <Database
                size={theme.iconSize.lg}
                color={checkingOldDatabase ? theme.colors.text.tertiary : theme.colors.text.black}
              />
              <Text
                className={`font-bold ${
                  checkingOldDatabase ? 'text-text-tertiary' : 'text-text-black'
                }`}
              >
                {checkingOldDatabase ? 'Checking...' : 'Check Old Database'}
              </Text>
            </Pressable>

            {migrationSummary && migrationSummary.tables.length > 0 ? (
              <View className="rounded-lg border border-border-light bg-bg-primary p-3">
                <Text className="mb-2 text-sm font-bold text-text-primary">
                  Found {migrationSummary!.tables.length} tables:
                </Text>
                <View className="gap-2">
                  {migrationSummary!.tables.map((tableName, index) => (
                    <View
                      key={index}
                      className="rounded-lg border border-border-light bg-bg-overlay p-2"
                    >
                      <Pressable
                        className="flex-row items-center justify-between"
                        onPress={() => toggleTableExpansion(tableName)}
                      >
                        <Text className="text-sm font-medium text-text-primary">{tableName}</Text>
                        <ChevronRight
                          size={theme.iconSize.sm}
                          color={theme.colors.text.secondary}
                          style={{
                            transform: [
                              { rotate: expandedTables.has(tableName) ? '90deg' : '0deg' },
                            ],
                          }}
                        />
                      </Pressable>

                      {expandedTables.has(tableName) && tableSchemas[tableName] ? (
                        <View className="mt-2 gap-1 pl-2">
                          <Text className="mb-1 text-xs font-bold uppercase text-text-tertiary">
                            Columns:
                          </Text>
                          {tableSchemas[tableName].map((column, colIndex) => (
                            <View key={colIndex} className="flex-row gap-2">
                              <Text className="text-xs text-text-secondary">{column.name}</Text>
                              <Text className="text-xs text-text-tertiary">{column.type}</Text>
                              {column.pk ? (
                                <Text className="text-xs font-bold text-accent-primary">PK</Text>
                              ) : null}
                              {column.notnull && !column.pk ? (
                                <Text className="text-xs text-text-tertiary">NOT NULL</Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {!checkingOldDatabase && migrationSummary?.tables.length === 0 ? (
              <Text className="py-2 text-sm text-text-tertiary">
                No old database found or no tables available
              </Text>
            ) : null}
          </View>

          {/* Migration Section */}
          <MigrationSection />

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
              onPress={addExercise}
            >
              <Plus size={theme.iconSize.lg} color={theme.colors.text.black} />
              <Text className="font-bold text-text-black">Add Exercise</Text>
            </Pressable>
          </View>

          {/* User Data Section */}
          <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary">User Profile</Text>
              <Pressable onPress={fetchUserData} className="p-2">
                <RefreshCw size={theme.iconSize.lg} color={theme.colors.text.secondary} />
              </Pressable>
            </View>

            {user ? (
              <View className="gap-3">
                <View className="rounded-lg border border-border-light bg-bg-primary p-3">
                  <Text className="mb-2 text-xs font-bold uppercase text-text-tertiary">
                    Personal Info
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Name:</Text> {user.fullName}
                  </Text>
                  {user.email ? (
                    <Text className="text-text-primary">
                      <Text className="font-bold">Email:</Text> {user.email}
                    </Text>
                  ) : null}
                  <Text className="text-text-primary">
                    <Text className="font-bold">DOB:</Text>{' '}
                    {new Date(user.dateOfBirth).toLocaleDateString()}
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Age:</Text> {user.getAge()} years
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Gender:</Text> {user.gender}
                  </Text>
                  {user.avatarIcon ? (
                    <Text className="text-text-primary">
                      <Text className="font-bold">Avatar Icon:</Text> {user.avatarIcon}
                    </Text>
                  ) : null}
                </View>

                <View className="rounded-lg border border-border-light bg-bg-primary p-3">
                  <Text className="mb-2 text-xs font-bold uppercase text-text-tertiary">
                    Fitness Info
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Goal:</Text> {user.fitnessGoal}
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Activity Level:</Text> {user.activityLevel}/5
                  </Text>
                  <Text className="text-text-primary">
                    <Text className="font-bold">Experience:</Text> {user.liftingExperience}
                  </Text>
                </View>

                <View className="rounded-lg border border-border-light bg-bg-primary p-3">
                  <Text className="mb-2 text-xs font-bold uppercase text-text-tertiary">
                    Timestamps
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Created: {new Date(user.createdAt).toLocaleString()}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Updated: {new Date(user.updatedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="py-4 text-center text-text-tertiary">No user profile found</Text>
            )}

            {/* Settings */}
            <View className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase text-text-tertiary">Settings</Text>
              {settings.length > 0 ? (
                <View className="gap-2">
                  {settings.map((setting) => (
                    <View
                      key={setting.id}
                      className="rounded-lg border border-border-light bg-bg-primary p-3"
                    >
                      <Text className="text-text-primary">
                        <Text className="font-bold">Type:</Text> {setting.type}
                      </Text>
                      <Text className="text-text-primary">
                        <Text className="font-bold">Value:</Text>{' '}
                        {setting.type === UNITS_SETTING_TYPE
                          ? setting.value === '0'
                            ? 'metric'
                            : 'imperial'
                          : setting.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="py-2 text-sm text-text-tertiary">No settings found</Text>
              )}
            </View>

            {/* User Metrics */}
            <View className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase text-text-tertiary">
                Recent Metrics ({userMetrics.length})
              </Text>
              {userMetrics.length > 0 ? (
                <View className="gap-2">
                  {userMetrics.slice(0, 10).map((metric) => (
                    <View
                      key={metric.id}
                      className="rounded-lg border border-border-light bg-bg-primary p-3"
                    >
                      <Text className="text-text-primary">
                        <Text className="font-bold">{metric.type}:</Text> {metric.value}{' '}
                        {metric.unit || 'N/A'}
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        Date: {new Date(metric.date).toLocaleDateString()}
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        Timezone: {metric.timezone}
                      </Text>
                    </View>
                  ))}
                  {userMetrics.length > 10 ? (
                    <Text className="text-xs text-text-tertiary">
                      ... and {userMetrics.length - 10} more
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className="py-2 text-sm text-text-tertiary">No metrics found</Text>
              )}
            </View>
          </View>

          {/* List Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-text-primary">Exercises</Text>
              <Text
                className="rounded-full bg-bg-overlay px-2 text-xs text-text-secondary"
                style={{ paddingVertical: theme.spacing.padding.xsHalf }}
              >
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
                  className="flex-row items-center justify-between rounded-xl border border-border-accent bg-bg-overlay p-4"
                >
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
