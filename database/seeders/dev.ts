import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENCRYPTION_KEY } from '../../constants/database';
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
} from '../../constants/misc';
import { setCurrentChatSessionId } from '../../utils/chatSessionStorage';
import { encryptNutritionLogSnapshot, encryptUserMetricFields } from '../encryptionHelpers';
import { database } from '../index';
import ChatMessage from '../models/ChatMessage';
import Exercise, {
  type EquipmentType,
  type MechanicType,
  type MuscleGroup,
} from '../models/Exercise';
import Food from '../models/Food';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';
import Meal from '../models/Meal';
import MenstrualCycle from '../models/MenstrualCycle';
import Setting from '../models/Setting';
import UserMetric from '../models/UserMetric';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogExercise from '../models/WorkoutLogExercise';
import WorkoutLogSet from '../models/WorkoutLogSet';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutTemplateExercise from '../models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '../models/WorkoutTemplateSet';
import {
  ChatService,
  ExerciseService,
  MealService,
  SettingsService,
  UserService,
} from '../services';

/**
 * Seeds the exercises database if it's empty
 * Only runs if there are no exercises in the database
 * Returns true if seeding was performed, false if database already had exercises
 */
async function seedExercisesIfEmpty(): Promise<boolean> {
  try {
    // Check if there are any exercises in the database
    const existingExercises = await ExerciseService.getAllExercises();

    // If database already has exercises, skip seeding
    if (existingExercises.length > 0) {
      return false;
    }

    // Database is empty, seed it using the service
    const createdExercises = await ExerciseService.createCommonExercises();
    console.log(`Seeded exercises database: ${createdExercises.length} exercises created`);
    return true;
  } catch (error) {
    console.error('Error seeding exercises database:', error);
    throw error;
  }
}

/**
 * Seeds workout templates and workout history data with completed workouts across multiple months
 * Creates workout templates, then workout logs linked to those templates with varying volumes
 * Only runs if workout_templates or workout_logs tables are empty
 */
async function seedWorkoutTemplatesAndHistory(shouldSeedWorkoutHistory = false): Promise<{
  templatesCreated: number;
  workoutsCreated: number;
}> {
  const now = Date.now();
  let templatesCreated = 0;
  let workoutsCreated = 0;

  try {
    // Check if tables are empty
    const existingTemplates = await database
      .get<WorkoutTemplate>('workout_templates')
      .query()
      .fetch();
    const existingLogs = await database.get<WorkoutLog>('workout_logs').query().fetch();

    const templatesExist = existingTemplates.length > 0;
    const logsExist = existingLogs.length > 0;

    // If templates already exist and either logs already exist or the caller
    // explicitly disabled seeding workout history, there's nothing to do.
    if (templatesExist && (logsExist || !shouldSeedWorkoutHistory)) {
      console.log(
        `Skipping workout seeding: ${existingTemplates.length} templates and ${existingLogs.length} workout logs already exist or history seeding disabled`
      );

      return { templatesCreated: 0, workoutsCreated: 0 };
    }

    await database.write(async () => {
      // Get some exercises to use in workouts
      const exercises = await database.get<Exercise>('exercises').query().fetch();

      if (exercises.length === 0) {
        console.warn('No exercises found. Please seed exercises first.');
        return { templatesCreated: 0, workoutsCreated: 0 };
      }

      // Helper to find exercises by name
      const findExercise = (name: string): Exercise | undefined => {
        return exercises.find((ex) => (ex.name ?? '').toLowerCase().includes(name.toLowerCase()));
      };

      // Helper to get or create a default exercise
      const getOrCreateExercise = async (name: string, muscleGroup: string): Promise<Exercise> => {
        let exercise = findExercise(name);
        if (!exercise) {
          exercise = await database.get<Exercise>('exercises').create((ex) => {
            ex.name = name;
            ex.description = `Default ${name}`;
            ex.muscleGroup = muscleGroup as MuscleGroup;
            ex.equipmentType = 'dumbbell' as EquipmentType;
            ex.mechanicType = 'compound' as MechanicType;
            ex.loadMultiplier = 1.0; // Default load multiplier
            ex.createdAt = now;
            ex.updatedAt = now;
          });
        }
        return exercise;
      };

      // Get or create exercises for the seed data
      const benchPress = await getOrCreateExercise('Bench Press', 'Chest');
      const squat = await getOrCreateExercise('Squat', 'Legs');
      const deadlift = await getOrCreateExercise('Deadlift', 'Back');
      const overheadPress = await getOrCreateExercise('Overhead Press', 'Shoulders');
      const bicepCurl = await getOrCreateExercise('Bicep Curl', 'Arms');
      const tricepExtension = await getOrCreateExercise('Tricep Extension', 'Arms');
      const latPulldown = await getOrCreateExercise('Lat Pulldown', 'Back');
      const legPress = await getOrCreateExercise('Leg Press', 'Legs');

      // --- Grouped Test Workout (for groupId persistence testing) ---
      let groupedTestTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Grouped Test Workout'
      );

      if (!groupedTestTemplate) {
        groupedTestTemplate = await database
          .get<WorkoutTemplate>('workout_templates')
          .create((t) => {
            t.name = 'Grouped Test Workout';
            t.description = 'A workout with two exercises grouped together';
            t.volumeCalculationType = 'standard';
            t.createdAt = now;
            t.updatedAt = now;
          });
        templatesCreated++;

        // Use the same groupId for the first two exercises (superset)
        const groupId = 'seed-group-1';

        // Create template exercises first, then their sets
        const benchExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = groupedTestTemplate!.id;
            te.exerciseId = benchPress.id;
            te.exerciseOrder = 1;
            te.groupId = groupId;
            te.createdAt = now;
            te.updatedAt = now;
          });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = benchExercise.id;
          ts.targetReps = 8;
          ts.targetWeight = 70;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ohpExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = groupedTestTemplate!.id;
            te.exerciseId = overheadPress.id;
            te.exerciseOrder = 2;
            te.groupId = groupId;
            te.createdAt = now;
            te.updatedAt = now;
          });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ohpExercise.id;
          ts.targetReps = 8;
          ts.targetWeight = 40;
          ts.restTimeAfter = 60;
          ts.setOrder = 2;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        // Add ungrouped exercises
        const bicepExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = groupedTestTemplate!.id;
            te.exerciseId = bicepCurl.id;
            te.exerciseOrder = 3;
            te.createdAt = now;
            te.updatedAt = now;
          });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = bicepExercise.id;
          ts.targetReps = 10;
          ts.targetWeight = 15;
          ts.restTimeAfter = 45;
          ts.setOrder = 3;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const tricepExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = groupedTestTemplate!.id;
            te.exerciseId = tricepExtension.id;
            te.exerciseOrder = 4;
            te.createdAt = now;
            te.updatedAt = now;
          });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = tricepExercise.id;
          ts.targetReps = 10;
          ts.targetWeight = 15;
          ts.restTimeAfter = 45;
          ts.setOrder = 4;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      // Create or find workout templates
      let upperBodyTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Upper Body Power'
      );
      let legDayTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Leg Day / Squats'
      );

      if (!upperBodyTemplate) {
        upperBodyTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
          t.name = 'Upper Body Power';
          t.description = 'Upper body strength and power workout';
          t.volumeCalculationType = 'standard';
          t.createdAt = now;
          t.updatedAt = now;
        });
        templatesCreated++;

        // Create template exercises and their sets for Upper Body Power
        const ubBenchExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = upperBodyTemplate!.id;
            te.exerciseId = benchPress.id;
            te.exerciseOrder = 1;
            te.createdAt = now;
            te.updatedAt = now;
          });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ubBenchExercise.id;
          ts.targetReps = 8;
          ts.targetWeight = 80;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ubOhpExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = upperBodyTemplate!.id;
            te.exerciseId = overheadPress.id;
            te.exerciseOrder = 2;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ubOhpExercise.id;
          ts.targetReps = 10;
          ts.targetWeight = 50;
          ts.restTimeAfter = 60;
          ts.setOrder = 2;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ubLatExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = upperBodyTemplate!.id;
            te.exerciseId = latPulldown.id;
            te.exerciseOrder = 3;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ubLatExercise.id;
          ts.targetReps = 10;
          ts.targetWeight = 70;
          ts.restTimeAfter = 60;
          ts.setOrder = 3;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ubBicepExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = upperBodyTemplate!.id;
            te.exerciseId = bicepCurl.id;
            te.exerciseOrder = 4;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ubBicepExercise.id;
          ts.targetReps = 12;
          ts.targetWeight = 15;
          ts.restTimeAfter = 60;
          ts.setOrder = 4;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      if (!legDayTemplate) {
        legDayTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
          t.name = 'Leg Day / Squats';
          t.description = 'Lower body strength workout';
          t.volumeCalculationType = 'standard';
          t.createdAt = now;
          t.updatedAt = now;
        });
        templatesCreated++;

        // Create template exercises and their sets for Leg Day
        const ldSquatExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = legDayTemplate!.id;
            te.exerciseId = squat.id;
            te.exerciseOrder = 1;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ldSquatExercise.id;
          ts.targetReps = 8;
          ts.targetWeight = 120;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ldLegPressExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = legDayTemplate!.id;
            te.exerciseId = legPress.id;
            te.exerciseOrder = 2;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ldLegPressExercise.id;
          ts.targetReps = 12;
          ts.restTimeAfter = 60;
          ts.targetWeight = 180;
          ts.setOrder = 2;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        const ldDeadliftExercise = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .create((te) => {
            te.templateId = legDayTemplate!.id;
            te.exerciseId = deadlift.id;
            te.exerciseOrder = 3;
            te.createdAt = now;
            te.updatedAt = now;
          });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateExerciseId = ldDeadliftExercise.id;
          ts.targetReps = 6;
          ts.targetWeight = 140;
          ts.restTimeAfter = 60;
          ts.setOrder = 3;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      if (shouldSeedWorkoutHistory && !logsExist) {
        // Helper to create a workout log with sets
        const createWorkoutLog = async (
          templateId: string,
          workoutName: string,
          startedAt: number,
          durationMinutes: number,
          exerciseSets: {
            exercise: Exercise;
            sets: { weight: number; reps: number }[];
            groupId?: string;
          }[],
          caloriesBurned?: number
        ): Promise<WorkoutLog> => {
          const completedAt = startedAt + durationMinutes * 60000;

          // Create workout log
          const workoutLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
            log.templateId = templateId;
            log.workoutName = workoutName;
            log.startedAt = startedAt;
            log.completedAt = completedAt;
            log.totalVolume = 0; // Will be calculated
            log.caloriesBurned = caloriesBurned;
            log.exhaustionLevel = undefined;
            log.workoutScore = undefined;
            log.createdAt = now;
            log.updatedAt = now;
          });

          // Create log exercises and their sets, and calculate total volume
          let totalVolume = 0;
          let setOrder = 1;
          let exerciseOrder = 1;

          for (const exerciseData of exerciseSets) {
            // Create the log exercise block
            const logExercise = await database
              .get<WorkoutLogExercise>('workout_log_exercises')
              .create((le) => {
                le.workoutLogId = workoutLog.id;
                le.exerciseId = exerciseData.exercise.id;
                le.exerciseOrder = exerciseOrder++;
                le.groupId = exerciseData.groupId;
                le.createdAt = now;
                le.updatedAt = now;
              });

            for (const set of exerciseData.sets) {
              const setVolume = set.weight * set.reps;
              totalVolume += setVolume;

              await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
                logSet.logExerciseId = logExercise.id;
                logSet.reps = set.reps;
                logSet.weight = set.weight;
                logSet.restTimeAfter = 60; // 60 seconds rest
                logSet.difficultyLevel = 7; // RPE 7
                logSet.isDropSet = false;
                logSet.setOrder = setOrder;
                logSet.createdAt = now;
                logSet.updatedAt = now;
              });

              setOrder++;
            }
          }

          // Update workout log with total volume
          await workoutLog.update((log) => {
            log.totalVolume = totalVolume;
          });

          return workoutLog;
        };

        // Helper to create a date N days ago
        const daysAgo = (days: number): number => {
          const date = new Date();
          date.setDate(date.getDate() - days);
          date.setHours(18, 30, 0, 0); // 6:30 PM
          return date.getTime();
        };

        // Helper to create a date in a specific month
        const dateInMonth = (
          year: number,
          month: number,
          day: number,
          hour: number = 18,
          minute: number = 30
        ): number => {
          const date = new Date(year, month, day, hour, minute, 0, 0);
          return date.getTime();
        };

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        // Create workout logs with varying volumes to show progression
        // Upper Body Power workouts - showing volume progression
        const upperBodyWorkouts = [
          // Most recent (highest volume)
          {
            startedAt: daysAgo(2),
            durationMinutes: 70,
            caloriesBurned: 520,
            exerciseSets: [
              {
                exercise: benchPress,
                groupId: 'upper-body-1',
                sets: [
                  { weight: 80, reps: 8 },
                  { weight: 80, reps: 8 },
                  { weight: 85, reps: 6 },
                ],
              },
              {
                exercise: overheadPress,
                groupId: 'upper-body-1',
                sets: [
                  { weight: 50, reps: 10 },
                  { weight: 52.5, reps: 8 },
                  { weight: 55, reps: 6 },
                ],
              },
              {
                exercise: latPulldown,
                groupId: undefined,
                sets: [
                  { weight: 70, reps: 10 },
                  { weight: 72.5, reps: 8 },
                ],
              },
              {
                exercise: bicepCurl,
                groupId: undefined,
                sets: [
                  { weight: 15, reps: 12 },
                  { weight: 17.5, reps: 10 },
                ],
              },
            ],
          },
          // Previous month
          {
            startedAt: dateInMonth(currentYear, currentMonth - 1, 24, 18, 30),
            durationMinutes: 70,
            caloriesBurned: 500,
            exerciseSets: [
              {
                exercise: benchPress,
                groupId: 'upper-body-2',
                sets: [
                  { weight: 78, reps: 8 },
                  { weight: 80, reps: 7 },
                  { weight: 82, reps: 6 },
                ],
              },
              {
                exercise: overheadPress,
                groupId: 'upper-body-2',
                sets: [
                  { weight: 49, reps: 10 },
                  { weight: 51, reps: 8 },
                ],
              },
              {
                exercise: bicepCurl,
                groupId: undefined,
                sets: [
                  { weight: 14, reps: 12 },
                  { weight: 16, reps: 10 },
                ],
              },
            ],
          },
          // Two months ago
          {
            startedAt: dateInMonth(currentYear, currentMonth - 2, 26, 18, 0),
            durationMinutes: 65,
            caloriesBurned: 480,
            exerciseSets: [
              {
                exercise: benchPress,
                sets: [
                  { weight: 75, reps: 10 },
                  { weight: 78, reps: 8 },
                ],
              },
              {
                exercise: overheadPress,
                sets: [
                  { weight: 47, reps: 10 },
                  { weight: 49, reps: 8 },
                ],
              },
              {
                exercise: tricepExtension,
                sets: [
                  { weight: 18, reps: 12 },
                  { weight: 20, reps: 10 },
                ],
              },
            ],
          },
        ];

        // Leg Day workouts - showing volume progression
        const legDayWorkouts = [
          // Most recent
          {
            startedAt: daysAgo(4),
            durationMinutes: 55,
            caloriesBurned: 410,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 120, reps: 8 },
                  { weight: 125, reps: 6 },
                  { weight: 130, reps: 5 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 180, reps: 12 },
                  { weight: 200, reps: 10 },
                ],
              },
              {
                exercise: deadlift,
                sets: [
                  { weight: 140, reps: 6 },
                  { weight: 150, reps: 5 },
                ],
              },
            ],
          },
          // Previous month
          {
            startedAt: dateInMonth(currentYear, currentMonth - 1, 20, 17, 45),
            durationMinutes: 55,
            caloriesBurned: 420,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 118, reps: 8 },
                  { weight: 122, reps: 7 },
                  { weight: 125, reps: 6 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 175, reps: 12 },
                  { weight: 190, reps: 10 },
                ],
              },
            ],
          },
          // Two months ago
          {
            startedAt: dateInMonth(currentYear, currentMonth - 2, 15, 10, 0),
            durationMinutes: 50,
            caloriesBurned: 380,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 115, reps: 8 },
                  { weight: 120, reps: 7 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 170, reps: 12 },
                  { weight: 180, reps: 10 },
                ],
              },
            ],
          },
        ];

        // Create all Upper Body Power workouts
        for (const workoutData of upperBodyWorkouts) {
          await createWorkoutLog(
            upperBodyTemplate!.id,
            'Upper Body Power',
            workoutData.startedAt,
            workoutData.durationMinutes,
            workoutData.exerciseSets,
            workoutData.caloriesBurned
          );
          workoutsCreated++;
        }

        // Create all Leg Day workouts
        for (const workoutData of legDayWorkouts) {
          await createWorkoutLog(
            legDayTemplate!.id,
            'Leg Day / Squats',
            workoutData.startedAt,
            workoutData.durationMinutes,
            workoutData.exerciseSets,
            workoutData.caloriesBurned
          );
          workoutsCreated++;
        }

        // Create a few more workouts without templates (ad-hoc workouts)
        const pushDayLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
          log.workoutName = 'Push Day';
          log.startedAt = daysAgo(7);
          log.completedAt = daysAgo(7) + 60 * 60000;
          log.totalVolume = 0;
          log.caloriesBurned = 450;
          log.exhaustionLevel = undefined;
          log.workoutScore = undefined;
          log.createdAt = now;
          log.updatedAt = now;
        });

        let totalVolume = 0;
        let setOrder = 1;
        let exerciseOrder = 1;
        const pushDaySets = [
          {
            exercise: benchPress,
            groupId: 'push-group-1',
            sets: [
              { weight: 75, reps: 10 },
              { weight: 80, reps: 8 },
              { weight: 82.5, reps: 6 },
            ],
          },
          {
            exercise: overheadPress,
            groupId: 'push-group-1',
            sets: [
              { weight: 48, reps: 10 },
              { weight: 50, reps: 8 },
            ],
          },
          {
            exercise: tricepExtension,
            groupId: undefined,
            sets: [
              { weight: 20, reps: 12 },
              { weight: 22.5, reps: 10 },
            ],
          },
        ];

        for (const exerciseData of pushDaySets) {
          // Create log exercise block first
          const logExercise = await database
            .get<WorkoutLogExercise>('workout_log_exercises')
            .create((le) => {
              le.workoutLogId = pushDayLog.id;
              le.exerciseId = exerciseData.exercise.id;
              le.exerciseOrder = exerciseOrder++;
              le.groupId = exerciseData.groupId;
              le.createdAt = now;
              le.updatedAt = now;
            });

          for (const set of exerciseData.sets) {
            totalVolume += set.weight * set.reps;
            await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
              logSet.logExerciseId = logExercise.id;
              logSet.reps = set.reps;
              logSet.weight = set.weight;
              logSet.restTimeAfter = 60;
              logSet.difficultyLevel = 7;
              logSet.isDropSet = false;
              logSet.setOrder = setOrder;
              logSet.createdAt = now;
              logSet.updatedAt = now;
            });
            setOrder++;
          }
        }

        await pushDayLog.update((log) => {
          log.totalVolume = totalVolume;
        });
        workoutsCreated++;
      }
    });

    console.log(
      `Seeded workout templates and history: ${templatesCreated} templates, ${workoutsCreated} workouts created`
    );
    return { templatesCreated, workoutsCreated };
  } catch (error) {
    console.error('Error seeding workout templates and history:', error);
    throw error;
  }
}

/**
 * Seeds workout history data with completed workouts across multiple months
 * Creates workout logs with different dates and associated workout log sets
 * @deprecated Use seedWorkoutTemplatesAndHistory instead
 */
async function seedWorkoutHistory(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await database.write(async () => {
      // Get some exercises to use in workouts
      const exercises = await database.get<Exercise>('exercises').query().fetch();

      if (exercises.length === 0) {
        console.warn('No exercises found. Please seed exercises first.');
        return { created: 0 };
      }

      // Helper to find exercises by name
      const findExercise = (name: string): Exercise | undefined => {
        return exercises.find((ex) => (ex.name ?? '').toLowerCase().includes(name.toLowerCase()));
      };

      // Helper to get or create a default exercise
      const getOrCreateExercise = async (name: string, muscleGroup: string): Promise<Exercise> => {
        let exercise = findExercise(name);
        if (!exercise) {
          // Create a simple exercise if not found
          exercise = await database.get<Exercise>('exercises').create((ex) => {
            ex.name = name;
            ex.description = `Default ${name}`;
            ex.muscleGroup = muscleGroup as MuscleGroup;
            ex.equipmentType = 'dumbbell' as EquipmentType;
            ex.mechanicType = 'compound' as MechanicType;
            ex.loadMultiplier = 1.0; // Default load multiplier
            ex.createdAt = now;
            ex.updatedAt = now;
          });
        }
        return exercise;
      };

      // Helper to create a workout log with sets
      const createWorkoutLog = async (
        workoutName: string,
        startedAt: number,
        durationMinutes: number,
        exerciseSets: {
          exercise: Exercise;
          sets: { weight: number; reps: number }[];
          groupId?: string;
        }[],
        caloriesBurned?: number
      ): Promise<WorkoutLog> => {
        const completedAt = startedAt + durationMinutes * 60000;

        // Create workout log
        const workoutLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
          log.workoutName = workoutName;
          log.startedAt = startedAt;
          log.completedAt = completedAt;
          log.totalVolume = 0; // Will be calculated
          log.caloriesBurned = caloriesBurned;
          log.exhaustionLevel = undefined;
          log.workoutScore = undefined;
          log.createdAt = now;
          log.updatedAt = now;
        });

        // Create log exercises and their sets, and calculate total volume
        let totalVolume = 0;
        let setOrder = 1;
        let exerciseOrder = 1;

        for (const exerciseData of exerciseSets) {
          // Create log exercise block first
          const logExercise = await database
            .get<WorkoutLogExercise>('workout_log_exercises')
            .create((le) => {
              le.workoutLogId = workoutLog.id;
              le.exerciseId = exerciseData.exercise.id;
              le.exerciseOrder = exerciseOrder++;
              le.groupId = exerciseData.groupId;
              le.createdAt = now;
              le.updatedAt = now;
            });

          for (const set of exerciseData.sets) {
            const setVolume = set.weight * set.reps;
            totalVolume += setVolume;

            await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
              logSet.logExerciseId = logExercise.id;
              logSet.reps = set.reps;
              logSet.weight = set.weight;
              logSet.restTimeAfter = 60; // 60 seconds rest
              logSet.difficultyLevel = 7; // RPE 7
              logSet.isDropSet = false;
              logSet.setOrder = setOrder;
              logSet.createdAt = now;
              logSet.updatedAt = now;
            });

            setOrder++;
          }
        }

        // Update workout log with total volume
        await workoutLog.update((log) => {
          log.totalVolume = totalVolume;
        });

        return workoutLog;
      };

      // Get or create exercises for the seed data
      const benchPress = await getOrCreateExercise('Bench Press', 'Chest');
      const squat = await getOrCreateExercise('Squat', 'Legs');
      const deadlift = await getOrCreateExercise('Deadlift', 'Back');
      const overheadPress = await getOrCreateExercise('Overhead Press', 'Shoulders');
      const bicepCurl = await getOrCreateExercise('Bicep Curl', 'Arms');
      const tricepExtension = await getOrCreateExercise('Tricep Extension', 'Arms');
      const latPulldown = await getOrCreateExercise('Lat Pulldown', 'Back');
      const legPress = await getOrCreateExercise('Leg Press', 'Legs');

      // Create workouts across different months
      // Current month - August 2024 (adjust dates as needed)
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Helper to create a date N days ago
      const daysAgo = (days: number): number => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        // Set time to a specific hour for consistency
        date.setHours(18, 30, 0, 0); // 6:30 PM
        return date.getTime();
      };

      // Helper to create a date in a specific month
      const dateInMonth = (
        year: number,
        month: number,
        day: number,
        hour: number = 18,
        minute: number = 30
      ): number => {
        const date = new Date(year, month, day, hour, minute, 0, 0);
        return date.getTime();
      };

      const workouts: {
        name: string;
        startedAt: number;
        durationMinutes: number;
        exerciseSets: { exercise: Exercise; sets: { weight: number; reps: number }[] }[];
        caloriesBurned?: number;
      }[] = [
        // Current month - recent workouts
        {
          name: 'Upper Body Power',
          startedAt: daysAgo(2),
          durationMinutes: 70,
          caloriesBurned: 520,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 80, reps: 8 },
                { weight: 80, reps: 8 },
                { weight: 85, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 50, reps: 10 },
                { weight: 52.5, reps: 8 },
                { weight: 55, reps: 6 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 70, reps: 10 },
                { weight: 72.5, reps: 8 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 15, reps: 12 },
                { weight: 17.5, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Leg Day / Squats',
          startedAt: daysAgo(4),
          durationMinutes: 55,
          caloriesBurned: 410,
          exerciseSets: [
            {
              exercise: squat,
              sets: [
                { weight: 120, reps: 8 },
                { weight: 125, reps: 6 },
                { weight: 130, reps: 5 },
              ],
            },
            {
              exercise: legPress,
              sets: [
                { weight: 180, reps: 12 },
                { weight: 200, reps: 10 },
              ],
            },
            {
              exercise: deadlift,
              sets: [
                { weight: 140, reps: 6 },
                { weight: 150, reps: 5 },
              ],
            },
          ],
        },
        {
          name: 'Push Day',
          startedAt: daysAgo(7),
          durationMinutes: 60,
          caloriesBurned: 450,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 75, reps: 10 },
                { weight: 80, reps: 8 },
                { weight: 82.5, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 48, reps: 10 },
                { weight: 50, reps: 8 },
              ],
            },
            {
              exercise: tricepExtension,
              sets: [
                { weight: 20, reps: 12 },
                { weight: 22.5, reps: 10 },
              ],
            },
          ],
        },
        // Previous month
        {
          name: 'Full Body Blast',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 28, 12, 0),
          durationMinutes: 75,
          caloriesBurned: 550,
          exerciseSets: [
            {
              exercise: deadlift,
              sets: [
                { weight: 135, reps: 6 },
                { weight: 145, reps: 5 },
              ],
            },
            {
              exercise: benchPress,
              sets: [
                { weight: 77.5, reps: 8 },
                { weight: 80, reps: 7 },
              ],
            },
            {
              exercise: squat,
              sets: [
                { weight: 115, reps: 10 },
                { weight: 120, reps: 8 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 68, reps: 10 },
                { weight: 70, reps: 9 },
              ],
            },
          ],
        },
        {
          name: 'Upper Body Power',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 24, 18, 30),
          durationMinutes: 70,
          caloriesBurned: 500,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 78, reps: 8 },
                { weight: 80, reps: 7 },
                { weight: 82, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 49, reps: 10 },
                { weight: 51, reps: 8 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 14, reps: 12 },
                { weight: 16, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Leg Day / Squats',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 20, 17, 45),
          durationMinutes: 55,
          caloriesBurned: 420,
          exerciseSets: [
            {
              exercise: squat,
              sets: [
                { weight: 118, reps: 8 },
                { weight: 122, reps: 7 },
                { weight: 125, reps: 6 },
              ],
            },
            {
              exercise: legPress,
              sets: [
                { weight: 175, reps: 12 },
                { weight: 190, reps: 10 },
              ],
            },
          ],
        },
        // Two months ago
        {
          name: 'Pull Day',
          startedAt: dateInMonth(currentYear, currentMonth - 2, 30, 10, 0),
          durationMinutes: 50,
          caloriesBurned: 380,
          exerciseSets: [
            {
              exercise: deadlift,
              sets: [
                { weight: 130, reps: 6 },
                { weight: 135, reps: 5 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 65, reps: 12 },
                { weight: 68, reps: 10 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 13, reps: 12 },
                { weight: 15, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Upper Body Power',
          startedAt: dateInMonth(currentYear, currentMonth - 2, 26, 18, 0),
          durationMinutes: 65,
          caloriesBurned: 480,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 75, reps: 10 },
                { weight: 78, reps: 8 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 47, reps: 10 },
                { weight: 49, reps: 8 },
              ],
            },
            {
              exercise: tricepExtension,
              sets: [
                { weight: 18, reps: 12 },
                { weight: 20, reps: 10 },
              ],
            },
          ],
        },
      ];

      // Create all workouts
      for (const workoutData of workouts) {
        await createWorkoutLog(
          workoutData.name,
          workoutData.startedAt,
          workoutData.durationMinutes,
          workoutData.exerciseSets,
          workoutData.caloriesBurned
        );
        created++;
      }
    });

    console.log(`Seeded workout history: ${created} workouts created`);
    return { created };
  } catch (error) {
    console.error('Error seeding workout history:', error);
    throw error;
  }
}

async function seedUserMetrics(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    await database.write(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Helper to create a date N days ago
      const daysAgo = (days: number): number => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(8, 30, 0, 0); // 8:30 AM for consistency
        return new Date(date.setUTCHours(0, 0, 0, 0)).getTime(); // Set to midnight for date tracking
      };

      // Helper to create a date in a specific month
      const dateInMonth = (year: number, month: number, day: number): number => {
        const date = new Date(year, month, day, 8, 30, 0, 0);
        return new Date(date.setUTCHours(0, 0, 0, 0)).getTime();
      };

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Assume user height is 180cm (1.8m) for BMI/FFMI calculations
      const heightM = 1.8;
      const heightM2 = heightM * heightM;

      // Weight progression: Start at 79.5kg, gradual decrease to 78.5kg over 3 months
      const weightData: { date: number; weight: number; bodyFat: number }[] = [
        // Current month
        { date: daysAgo(0), weight: 78.5, bodyFat: 15.0 },
        { date: daysAgo(3), weight: 78.7, bodyFat: 15.2 },
        { date: daysAgo(7), weight: 78.9, bodyFat: 15.1 },
        { date: daysAgo(10), weight: 79.1, bodyFat: 15.3 },
        { date: daysAgo(14), weight: 79.0, bodyFat: 15.2 },
        { date: daysAgo(18), weight: 79.2, bodyFat: 15.4 },
        { date: daysAgo(21), weight: 79.3, bodyFat: 15.3 },

        // Previous month
        { date: dateInMonth(currentYear, currentMonth - 1, 28), weight: 79.2, bodyFat: 15.5 },
        { date: dateInMonth(currentYear, currentMonth - 1, 24), weight: 79.4, bodyFat: 15.6 },
        { date: dateInMonth(currentYear, currentMonth - 1, 20), weight: 79.3, bodyFat: 15.5 },
        { date: dateInMonth(currentYear, currentMonth - 1, 15), weight: 79.5, bodyFat: 15.7 },
        { date: dateInMonth(currentYear, currentMonth - 1, 10), weight: 79.4, bodyFat: 15.6 },
        { date: dateInMonth(currentYear, currentMonth - 1, 5), weight: 79.6, bodyFat: 15.8 },
        { date: dateInMonth(currentYear, currentMonth - 1, 1), weight: 79.5, bodyFat: 15.7 },

        // Two months ago
        { date: dateInMonth(currentYear, currentMonth - 2, 28), weight: 79.6, bodyFat: 15.9 },
        { date: dateInMonth(currentYear, currentMonth - 2, 24), weight: 79.7, bodyFat: 16.0 },
        { date: dateInMonth(currentYear, currentMonth - 2, 20), weight: 79.6, bodyFat: 15.9 },
        { date: dateInMonth(currentYear, currentMonth - 2, 15), weight: 79.8, bodyFat: 16.1 },
        { date: dateInMonth(currentYear, currentMonth - 2, 10), weight: 79.7, bodyFat: 16.0 },
        { date: dateInMonth(currentYear, currentMonth - 2, 5), weight: 79.9, bodyFat: 16.2 },
      ];

      // Create metrics for each date
      for (const data of weightData) {
        // Calculate BMI: BMI = weight (kg) / height (m)^2
        const bmi = data.weight / heightM2;

        // Calculate FFMI: FFMI = (weight * (1 - bodyFat/100)) / height (m)^2
        const fatFreeMass = data.weight * (1 - data.bodyFat / 100);
        const ffmi = fatFreeMass / heightM2;

        const encryptedWeight = await encryptUserMetricFields({
          value: data.weight,
          unit: 'kg',
          date: data.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'weight';
          metric.valueRaw = encryptedWeight.value;
          metric.unitRaw = encryptedWeight.unit;
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        const encryptedBodyFat = await encryptUserMetricFields({
          value: data.bodyFat,
          unit: '%',
          date: data.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'body_fat';
          metric.valueRaw = encryptedBodyFat.value;
          metric.unitRaw = encryptedBodyFat.unit;
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        const encryptedBmi = await encryptUserMetricFields({
          value: bmi,
          unit: '',
          date: data.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'bmi';
          metric.valueRaw = encryptedBmi.value;
          metric.unitRaw = encryptedBmi.unit;
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        const encryptedFfmi = await encryptUserMetricFields({
          value: ffmi,
          unit: '',
          date: data.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'ffmi';
          metric.valueRaw = encryptedFfmi.value;
          metric.unitRaw = encryptedFfmi.unit;
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        // Add energy levels (mood)
        const energyValue = 5 + Math.sin(data.date / (5 * 24 * 60 * 60 * 1000)) * 4;
        const encryptedEnergy = await encryptUserMetricFields({
          value: energyValue,
          unit: '',
          date: data.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'mood';
          metric.valueRaw = encryptedEnergy.value;
          metric.unitRaw = encryptedEnergy.unit;
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;
      }
    });

    console.log(`Seeded user metrics: ${created} metrics created`);
    return { created };
  } catch (error) {
    console.error('Error seeding user metrics:', error);
    throw error;
  }
}

async function seedMenstrualCycle(): Promise<void> {
  const now = Date.now();
  try {
    const existing = await database.get<MenstrualCycle>('menstrual_cycles').query().fetch();
    if (existing.length > 0) {
      return;
    }

    await database.write(async () => {
      await database.get<MenstrualCycle>('menstrual_cycles').create((c) => {
        c.avgCycleLength = 28;
        c.avgPeriodDuration = 5;
        c.useHormonalBirthControl = false;
        c.lastPeriodStartDate = Date.now() - 14 * 24 * 60 * 60 * 1000;
        c.isActive = true;
        c.createdAt = now;
        c.updatedAt = now;
      });
    });
    console.log('Seeded menstrual cycle');
  } catch (error) {
    console.error('Error seeding menstrual cycle:', error);
  }
}

/**
 * Seeds the foods database with test data for the unified search functionality
 * Only runs if the foods table is empty
 * Returns true if seeding was performed, false if database already had foods
 */
async function seedFoods(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    // Check if there are any foods in the database
    const existingFoods = await database.get<Food>('foods').query().fetch();

    // If database already has foods, skip seeding
    if (existingFoods.length > 0) {
      console.log(`Skipping food seeding: ${existingFoods.length} foods already exist`);
      return { created: 0 };
    }

    await database.write(async () => {
      // Simple foods for easy testing
      const simpleFoods = [
        {
          name: 'Banana',
          brand: 'Nature',
          calories: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
          fiber: 2.6,
          isFavorite: true,
        },
        {
          name: 'Chicken Breast',
          brand: 'Farm Fresh',
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Brown Rice',
          brand: 'Organic Farms',
          calories: 111,
          protein: 2.6,
          carbs: 23,
          fat: 0.9,
          fiber: 1.8,
          isFavorite: false,
        },
        {
          name: 'Eggs',
          brand: 'Happy Hens',
          calories: 155,
          protein: 13,
          carbs: 1.1,
          fat: 11,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Greek Yogurt',
          brand: 'Dairy Fresh',
          calories: 100,
          protein: 17,
          carbs: 6,
          fat: 0.7,
          fiber: 0,
          isFavorite: false,
        },
        {
          name: 'Oatmeal',
          brand: 'Whole Grains',
          calories: 68,
          protein: 2.4,
          carbs: 12,
          fat: 1.4,
          fiber: 1.7,
          isFavorite: false,
        },
        {
          name: 'Salmon',
          brand: 'Ocean Fresh',
          calories: 208,
          protein: 20,
          carbs: 0,
          fat: 13,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Sweet Potato',
          brand: 'Root Vegetables',
          calories: 86,
          protein: 1.6,
          carbs: 20,
          fat: 0.1,
          fiber: 3,
          isFavorite: false,
        },
      ];

      // Complex foods for testing
      const complexFoods = [
        {
          name: 'Chinese Corn Noodles with Chicken Broth',
          brand: 'Asian Kitchen',
          calories: 320,
          protein: 18,
          carbs: 42,
          fat: 8,
          fiber: 3.5,
          isFavorite: false,
        },
        {
          name: 'Mediterranean Quinoa Bowl',
          brand: 'Healthy Bowls',
          calories: 380,
          protein: 14,
          carbs: 52,
          fat: 14,
          fiber: 8,
          isFavorite: true,
        },
        {
          name: 'Protein Power Smoothie',
          brand: 'Fitness Fuel',
          calories: 280,
          protein: 25,
          carbs: 35,
          fat: 6,
          fiber: 4,
          isFavorite: false,
        },
      ];

      const allFoods = [...simpleFoods, ...complexFoods];

      for (const foodData of allFoods) {
        const food = await database.get<Food>('foods').create((food) => {
          food.isAiGenerated = false;
          food.name = foodData.name;
          food.brand = foodData.brand;
          food.barcode = undefined;
          food.calories = foodData.calories;
          food.protein = foodData.protein;
          food.carbs = foodData.carbs;
          food.fat = foodData.fat;
          food.fiber = foodData.fiber;
          food.micros = {}; // Empty micros for now
          food.isFavorite = foodData.isFavorite;
          food.source = 'user';
          food.createdAt = now;
          food.updatedAt = now;
        });

        // Create or find the default 100g portion (global, reusable)
        const existingPortion = await database
          .get<FoodPortion>('food_portions')
          .query(Q.where('name', '100g'), Q.where('gram_weight', 100))
          .fetch();

        const defaultPortion =
          existingPortion.length > 0
            ? existingPortion[0]
            : await database.get<FoodPortion>('food_portions').create((portion) => {
                portion.name = '100g';
                portion.gramWeight = 100;
                portion.createdAt = now;
                portion.updatedAt = now;
              });

        // Link food to portion via junction table
        await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
          ffp.foodId = food.id;
          ffp.foodPortionId = defaultPortion.id;
          ffp.isDefault = true;
          ffp.createdAt = now;
          ffp.updatedAt = now;
        });

        created++;
      }
    });

    console.log(`Seeded foods database: ${created} foods created`);
    return { created };
  } catch (error) {
    console.error('Error seeding foods database:', error);
    throw error;
  }
}

/**
 * Seeds nutrition logs (last 14 days) and a default nutrition goal.
 * Runs independently of food seeding so it works even when foods were already
 * seeded by the production seeder (USDA foods).
 */
async function seedNutritionLogsAndGoal(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    const existingLogs = await database.get<any>('nutrition_logs').query().fetch();
    if (existingLogs.length > 0) {
      console.log(`Skipping nutrition log seeding: ${existingLogs.length} logs already exist`);
      return { created: 0 };
    }

    // These foods must exist with exact names so logs can reference them.
    // We create them here if missing — USDA food names differ (e.g. "Bananas, raw").
    const devFoodDefs = [
      { name: 'Banana', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 },
      { name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0 },
      { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
      { name: 'Brown Rice', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8 },
      { name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
      { name: 'Sweet Potato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3 },
    ];

    // Get or create the 100g portion needed to link foods
    const existing100g = await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('name', '100g'), Q.where('gram_weight', 100))
      .fetch();

    const devFoods = new Map<string, Food>();

    await database.write(async () => {
      const portion100g =
        existing100g.length > 0
          ? existing100g[0]
          : await database.get<FoodPortion>('food_portions').create((p) => {
              p.name = '100g';
              p.gramWeight = 100;
              p.createdAt = now;
              p.updatedAt = now;
            });

      for (const def of devFoodDefs) {
        // Check by exact name (case-insensitive)
        const existing = await database.get<Food>('foods').query(Q.where('name', def.name)).fetch();

        let food: Food;
        if (existing.length > 0) {
          food = existing[0];
        } else {
          food = await database.get<Food>('foods').create((f) => {
            f.isAiGenerated = false;
            f.name = def.name;
            f.calories = def.calories;
            f.protein = def.protein;
            f.carbs = def.carbs;
            f.fat = def.fat;
            f.fiber = def.fiber;
            f.micros = {};
            f.isFavorite = false;
            f.source = 'user';
            f.createdAt = now;
            f.updatedAt = now;
          });

          await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
            ffp.foodId = food.id;
            ffp.foodPortionId = portion100g.id;
            ffp.isDefault = true;
            ffp.createdAt = now;
            ffp.updatedAt = now;
          });
        }

        devFoods.set(def.name, food);
      }
    });

    const daysAgo = (days: number): number => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      date.setHours(0, 0, 0, 0); // local midnight — matches NutritionService query logic
      return date.getTime();
    };

    // Each day rotates through different meal combinations
    const dailyPlans: { name: string; type: string; amount: number }[][] = [
      // Day 0 — standard day
      [
        { name: 'Banana', type: 'breakfast', amount: 120 },
        { name: 'Greek Yogurt', type: 'breakfast', amount: 150 },
        { name: 'Chicken Breast', type: 'lunch', amount: 200 },
        { name: 'Brown Rice', type: 'lunch', amount: 150 },
        { name: 'Salmon', type: 'dinner', amount: 180 },
        { name: 'Sweet Potato', type: 'dinner', amount: 200 },
      ],
      // Day 1 — lighter lunch, bigger dinner
      [
        { name: 'Greek Yogurt', type: 'breakfast', amount: 200 },
        { name: 'Banana', type: 'snack', amount: 100 },
        { name: 'Chicken Breast', type: 'lunch', amount: 150 },
        { name: 'Salmon', type: 'dinner', amount: 220 },
        { name: 'Sweet Potato', type: 'dinner', amount: 250 },
      ],
      // Day 2 — rice-heavy day
      [
        { name: 'Banana', type: 'breakfast', amount: 130 },
        { name: 'Chicken Breast', type: 'lunch', amount: 220 },
        { name: 'Brown Rice', type: 'lunch', amount: 200 },
        { name: 'Greek Yogurt', type: 'snack', amount: 150 },
        { name: 'Sweet Potato', type: 'dinner', amount: 180 },
      ],
      // Day 3 — salmon day, no snack
      [
        { name: 'Greek Yogurt', type: 'breakfast', amount: 180 },
        { name: 'Brown Rice', type: 'lunch', amount: 180 },
        { name: 'Chicken Breast', type: 'lunch', amount: 180 },
        { name: 'Salmon', type: 'dinner', amount: 200 },
        { name: 'Sweet Potato', type: 'dinner', amount: 220 },
      ],
      // Day 4 — two snacks, lighter meals
      [
        { name: 'Banana', type: 'breakfast', amount: 110 },
        { name: 'Greek Yogurt', type: 'snack', amount: 120 },
        { name: 'Chicken Breast', type: 'lunch', amount: 160 },
        { name: 'Brown Rice', type: 'lunch', amount: 130 },
        { name: 'Banana', type: 'snack', amount: 90 },
        { name: 'Salmon', type: 'dinner', amount: 160 },
      ],
      // Day 5 — big lunch
      [
        { name: 'Greek Yogurt', type: 'breakfast', amount: 150 },
        { name: 'Chicken Breast', type: 'lunch', amount: 250 },
        { name: 'Brown Rice', type: 'lunch', amount: 200 },
        { name: 'Sweet Potato', type: 'lunch', amount: 150 },
        { name: 'Salmon', type: 'dinner', amount: 150 },
      ],
      // Day 6 — rest day, lower carbs
      [
        { name: 'Greek Yogurt', type: 'breakfast', amount: 200 },
        { name: 'Chicken Breast', type: 'lunch', amount: 200 },
        { name: 'Salmon', type: 'dinner', amount: 200 },
        { name: 'Sweet Potato', type: 'dinner', amount: 150 },
      ],
    ];

    await database.write(async () => {
      for (let i = 0; i < 14; i++) {
        const date = daysAgo(i);
        const plan = dailyPlans[i % dailyPlans.length];
        for (const entry of plan) {
          const f = devFoods.get(entry.name);
          if (!f) {
            continue;
          }

          const encrypted = await encryptNutritionLogSnapshot({
            loggedFoodName: f.name ?? 'Unknown',
            loggedCalories: f.calories ?? 0,
            loggedProtein: f.protein ?? 0,
            loggedCarbs: f.carbs ?? 0,
            loggedFat: f.fat ?? 0,
            loggedFiber: f.fiber ?? 0,
            loggedMicros: f.micros,
          });

          await database.get<any>('nutrition_logs').create((log: any) => {
            log.foodId = f.id;
            log.date = date;
            log.type = entry.type;
            log.amount = entry.amount;
            log.portionId = undefined;
            log.loggedFoodNameRaw = encrypted.loggedFoodName;
            log.loggedCaloriesRaw = encrypted.loggedCalories;
            log.loggedProteinRaw = encrypted.loggedProtein;
            log.loggedCarbsRaw = encrypted.loggedCarbs;
            log.loggedFatRaw = encrypted.loggedFat;
            log.loggedFiberRaw = encrypted.loggedFiber;
            log.loggedMicrosRaw = encrypted.loggedMicrosJson;
            log.createdAt = now;
            log.updatedAt = now;
          });
          created++;
        }
      }

      // Seed a default nutrition goal if none exist
      const existingGoals = await database.get<any>('nutrition_goals').query().fetch();
      if (existingGoals.length === 0) {
        await database.get<any>('nutrition_goals').create((goal: any) => {
          goal.totalCalories = 2500;
          goal.protein = 180;
          goal.carbs = 300;
          goal.fats = 80;
          goal.fiber = 30;
          goal.eatingPhase = 'maintain';
          goal.targetWeight = 78.5;
          goal.targetBodyFat = 15.0;
          goal.targetBmi = 24.2;
          goal.targetFfmi = 19.5;
          goal.targetDate = undefined;
          goal.effectiveUntil = undefined;
          goal.createdAt = now;
          goal.updatedAt = now;
        });
        created++;
      }
    });

    console.log(`Seeded nutrition logs and goal: ${created} records created`);
    return { created };
  } catch (error) {
    console.error('Error seeding nutrition logs and goal:', error);
    throw error;
  }
}

/**
 * Seeds the meals database with test meal data
 * Creates meals with foods via the meal_foods pivot table
 * Only runs if the meals table is empty
 * Returns number of meals created
 */
async function seedMeals(): Promise<{ created: number }> {
  let created = 0;

  try {
    // Check if there are any meals in the database
    const existingMeals = await database.get<Meal>('meals').query().fetch();

    // If database already has meals, skip seeding
    if (existingMeals.length > 0) {
      console.log(`Skipping meal seeding: ${existingMeals.length} meals already exist`);
      return { created: 0 };
    }

    // Get all foods from the database to use in meals
    const foods = await database.get<Food>('foods').query().fetch();

    if (foods.length === 0) {
      console.warn('No foods found. Please seed foods before seeding meals.');
      return { created: 0 };
    }

    // Create a map for easy food lookup by name
    const foodByName = new Map<string, Food>(foods.map((f) => [(f.name ?? '').toLowerCase(), f]));

    // Helper to get food by name
    const getFood = (name: string): Food | undefined => {
      return foodByName.get(name.toLowerCase());
    };

    // Meal 1: Chicken & Rice Bowl
    const chickenBreast = getFood('chicken breast');
    const brownRice = getFood('brown rice');

    if (chickenBreast && brownRice) {
      await MealService.createMealFromFoods(
        'Chicken & Rice Bowl',
        [
          { foodId: chickenBreast.id, amount: 200 }, // 200g chicken breast
          { foodId: brownRice.id, amount: 200 }, // 200g brown rice
        ],
        'High protein meal with lean chicken and brown rice'
      );
      created++;
    }

    // Meal 2: Oatmeal & Berries
    const oatmeal = getFood('oatmeal');
    const banana = getFood('banana');
    const greekYogurt = getFood('greek yogurt');

    if (oatmeal && banana && greekYogurt) {
      await MealService.createMealFromFoods(
        'Oatmeal & Berries',
        [
          { foodId: oatmeal.id, amount: 150 }, // 150g oatmeal
          { foodId: banana.id, amount: 120 }, // 120g banana (as berry substitute)
          { foodId: greekYogurt.id, amount: 100 }, // 100g greek yogurt
        ],
        'Healthy breakfast with oats, fruit, and yogurt'
      );
      created++;
    }

    // Meal 3: Salmon Salad
    const salmon = getFood('salmon');
    const sweetPotato = getFood('sweet potato');

    if (salmon && sweetPotato) {
      await MealService.createMealFromFoods(
        'Salmon Salad',
        [
          { foodId: salmon.id, amount: 180 }, // 180g salmon
          { foodId: sweetPotato.id, amount: 150 }, // 150g sweet potato
        ],
        'Omega-3 rich salmon with roasted sweet potato'
      );
      created++;
    }

    // Meal 4: Avocado Toast & Egg
    const eggs = getFood('eggs');

    if (eggs && banana) {
      await MealService.createMealFromFoods(
        'Avocado Toast & Egg',
        [
          { foodId: eggs.id, amount: 150 }, // 150g eggs (about 2 large eggs)
          { foodId: banana.id, amount: 100 }, // 100g banana (as toast substitute)
        ],
        'Protein-rich breakfast with eggs'
      );
      created++;
    }

    console.log(`Seeded meals database: ${created} meals created`);
    return { created };
  } catch (error) {
    console.error('Error seeding meals database:', error);
    throw error;
  }
}

async function seedUser(): Promise<boolean> {
  try {
    const existingUser = await UserService.getCurrentUser();
    if (existingUser) {
      return false;
    }

    await UserService.initializeUser({
      fullName: 'Alex Johnson',
      dateOfBirth: new Date(1990, 3, 15).getTime(), // April 15, 1990
      gender: 'male',
      fitnessGoal: 'hypertrophy',
      weightGoal: 'maintain',
      activityLevel: 3,
      liftingExperience: 'intermediate',
      email: 'alex@example.com',
      avatarIcon: 'person',
      avatarColor: 'blue',
    });

    console.log('Seeded dev user: Alex Johnson');
    return true;
  } catch (error) {
    console.error('Error seeding user:', error);
    throw error;
  }
}

async function seedChatHistory(): Promise<{ created: number }> {
  let created = 0;
  try {
    // Only skip if dev conversation messages (exercise/nutrition context) already exist.
    // The prod seeder creates a single 'general' welcome message which should not block seeding.
    const existingDevMessages = await database
      .get<ChatMessage>('chat_messages')
      .query(Q.where('context', Q.notEq('general')))
      .fetch();
    if (existingDevMessages.length > 0) {
      console.log(
        `Skipping chat history seeding: ${existingDevMessages.length} non-general messages already exist`
      );
      return { created: 0 };
    }

    const now = Date.now();
    // Space messages a few minutes apart to simulate real conversations
    const msAgo = (minutes: number): number => now - minutes * 60 * 1000;

    // Single sessionId shared across all contexts — matches how the app works
    const sessionId = ChatService.generateSessionId();
    // Persist so the app's useChatMessages hook resolves to the same session
    await setCurrentChatSessionId(sessionId);

    interface MessageDef {
      sender: 'user' | 'coach';
      message: string;
      minutesAgo: number;
    }

    const createConversation = async (
      context: 'general' | 'nutrition' | 'exercise',
      messages: MessageDef[]
    ): Promise<void> => {
      await database.write(async () => {
        for (const msg of messages) {
          const ts = msAgo(msg.minutesAgo);
          await database.get<ChatMessage>('chat_messages').create((record) => {
            record.sessionId = sessionId;
            record.sender = msg.sender;
            record.message = msg.message;
            record.messageType = 'text';
            record.context = context;
            record.createdAt = ts;
            record.updatedAt = ts;
          });
          created++;
        }
      });
    };

    // General context conversation (from ~3 days ago)
    const threeDaysMin = 3 * 24 * 60;
    await createConversation('general', [
      {
        sender: 'coach',
        message: "Hey Alex! I'm Loggy, your personal fitness coach. How can I help you today?",
        minutesAgo: threeDaysMin + 20,
      },
      {
        sender: 'user',
        message:
          "Hi! I'm trying to build muscle and lose some fat at the same time. Is that even possible?",
        minutesAgo: threeDaysMin + 18,
      },
      {
        sender: 'coach',
        message:
          "Great question! Body recomposition — building muscle while losing fat — is definitely possible, especially for people at an intermediate level like you. The key is eating around your maintenance calories with high protein (around 2g per kg of bodyweight), progressive overload in your training, and getting quality sleep. It's slower than a dedicated bulk or cut, but very achievable.",
        minutesAgo: threeDaysMin + 16,
      },
      {
        sender: 'user',
        message: 'That makes sense. How much sleep should I be getting?',
        minutesAgo: threeDaysMin + 14,
      },
      {
        sender: 'coach',
        message:
          'Aim for 7–9 hours per night. Sleep is when your body releases growth hormone and repairs muscle tissue. Consistently getting less than 7 hours can blunt muscle growth, increase cortisol, and make it harder to lose fat. If you struggle with sleep, try keeping a consistent sleep schedule and avoiding screens 30 minutes before bed.',
        minutesAgo: threeDaysMin + 12,
      },
      {
        sender: 'user',
        message: "Got it. I usually get around 7 hours. Seems like I'm on the right track!",
        minutesAgo: threeDaysMin + 10,
      },
      {
        sender: 'coach',
        message:
          "You are! 7 hours is solid. Keep it consistent and pair it with your training and nutrition, and you'll see great results over time. Is there anything else on your mind?",
        minutesAgo: threeDaysMin + 8,
      },
    ]);

    // Nutrition context conversation (from ~2 days ago)
    const twoDaysMin = 2 * 24 * 60;
    await createConversation('nutrition', [
      {
        sender: 'user',
        message: 'I had chicken breast, brown rice, and broccoli for lunch. How does that look?',
        minutesAgo: twoDaysMin + 30,
      },
      {
        sender: 'coach',
        message:
          "That's a textbook bodybuilding meal — well done! You're getting lean protein from the chicken, complex carbs and fiber from the rice and broccoli. If I had to estimate: roughly 450–550 kcal, ~45g protein, ~50g carbs, ~5g fat. How much of each did you have?",
        minutesAgo: twoDaysMin + 27,
      },
      {
        sender: 'user',
        message: 'About 200g chicken, 150g rice, and a handful of broccoli.',
        minutesAgo: twoDaysMin + 25,
      },
      {
        sender: 'coach',
        message:
          "Nice portions! That gives you roughly 62g of protein from the chicken alone — great for muscle synthesis. Your total is around 520 kcal. Make sure the rest of your meals today keep you around your target of 2500 kcal and 180g protein. How's your breakfast been?",
        minutesAgo: twoDaysMin + 22,
      },
      {
        sender: 'user',
        message:
          'I had oatmeal with a banana and some greek yogurt. Is that a good pre-workout meal?',
        minutesAgo: twoDaysMin + 20,
      },
      {
        sender: 'coach',
        message:
          'Yes! Oatmeal + banana gives you fast and slow-digesting carbs for sustained energy, and the Greek yogurt adds a nice protein boost. Eating this 1–2 hours before training is ideal. One tip: add a handful of berries or some nut butter to get more micronutrients or healthy fats.',
        minutesAgo: twoDaysMin + 17,
      },
      {
        sender: 'user',
        message: "I'll try the nut butter idea. Thanks!",
        minutesAgo: twoDaysMin + 15,
      },
      {
        sender: 'coach',
        message:
          "You're welcome! Keep logging your meals — consistency in tracking is one of the best habits you can build. You're doing great so far today!",
        minutesAgo: twoDaysMin + 13,
      },
    ]);

    // Exercise context conversation (from ~1 day ago)
    const oneDayMin = 1 * 24 * 60;
    await createConversation('exercise', [
      {
        sender: 'user',
        message:
          'I just finished my Upper Body Power workout. Bench press felt really heavy today.',
        minutesAgo: oneDayMin + 40,
      },
      {
        sender: 'coach',
        message:
          "Nice work finishing the session! Heavy days happen — it could be accumulated fatigue, hydration, sleep, or just natural variation. Looking at your log, you hit 80kg×8, 80kg×8, and 85kg×6. That's solid volume. How did the rest of the session feel?",
        minutesAgo: oneDayMin + 37,
      },
      {
        sender: 'user',
        message:
          'OHP and lat pulldown felt fine. Bicep curls were the easiest part as always haha.',
        minutesAgo: oneDayMin + 35,
      },
      {
        sender: 'coach',
        message:
          "That's pretty common — biceps get a lot of indirect work from rows and pulldowns so they're usually less fatigued. For the bench, try dropping 5% weight next session and focusing on a slow 3-second eccentric. That can help with strength-endurance and reduce joint stress.",
        minutesAgo: oneDayMin + 32,
      },
      {
        sender: 'user',
        message: 'Should I add more sets to the bench or stick with 3 working sets?',
        minutesAgo: oneDayMin + 30,
      },
      {
        sender: 'coach',
        message:
          "3 working sets is a great starting point for hypertrophy — it's well within the effective volume range (10–20 sets per muscle group per week). If you're recovering well and want to push more volume, you can add a 4th set in a few weeks. For now, focus on progressive overload by adding 2.5kg once you can hit all reps with good form.",
        minutesAgo: oneDayMin + 27,
      },
      {
        sender: 'user',
        message: 'Makes sense. What about my leg day? Should I add Romanian deadlifts?',
        minutesAgo: oneDayMin + 25,
      },
      {
        sender: 'coach',
        message:
          "Romanian deadlifts (RDLs) are excellent for hamstring development and hip hinge mechanics. Given that your leg day already has squats, leg press, and deadlifts, I'd swap a deadlift set for RDLs, or add them as a lighter accessory at the end. Start with 3×10–12 at moderate weight and focus on feeling the hamstring stretch.",
        minutesAgo: oneDayMin + 22,
      },
      {
        sender: 'user',
        message: "Perfect, I'll try that next leg day. Thanks Loggy!",
        minutesAgo: oneDayMin + 20,
      },
      {
        sender: 'coach',
        message:
          "Anytime! You're making great progress — your squat has gone up 15kg over the past 3 months. Keep pushing and let me know how the RDLs feel!",
        minutesAgo: oneDayMin + 18,
      },
    ]);

    console.log(`Seeded chat history: ${created} messages created across 3 conversation contexts`);
    return { created };
  } catch (error) {
    console.error('Error seeding chat history:', error);
    throw error;
  }
}

const clearAsyncStorage = async () => {
  const existingEncryptionKey = await AsyncStorage.getItem(ENCRYPTION_KEY);

  try {
    await AsyncStorage.clear();
    console.log('AsyncStorage has been cleared successfully.');
  } catch (error) {
    console.error('Error clearing AsyncStorage:', error);
  }

  if (existingEncryptionKey) {
    await AsyncStorage.setItem(ENCRYPTION_KEY, existingEncryptionKey);
  }
};

export async function seedDevData(clear: boolean = true): Promise<boolean> {
  // return true;

  if (clear) {
    try {
      // Note: unsafeResetDatabase() MUST be called inside a write transaction
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });

      // TODO: super ugly hack, figure out a way to not do this
      // Longer delay to ensure IndexedDB connections are closed and database is ready.
      // On web, IndexedDB may log "blocked" warnings if connections are still open during
      // deletion. These warnings are harmless - the adapter handles them internally and
      // the reset completes successfully. This delay minimizes the chance of seeing them.
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify database is ready by attempting a simple query
      // This ensures the reset completed and the database is accessible
      let retries = 0;
      const maxRetries = 3;
      while (retries < maxRetries) {
        try {
          await database.get<Setting>('settings').query().fetchCount();
          break; // Success, exit retry loop
        } catch (verifyError) {
          retries++;
          if (retries >= maxRetries) {
            throw verifyError; // Re-throw if all retries failed
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      console.log('Database reset (clean slate for seeding)');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error; // Re-throw to prevent continuing with a broken database state
    }

    // Clear async storage
    await clearAsyncStorage();
  }

  const userSeeded = await seedUser();
  const exercisesSeeded = await seedExercisesIfEmpty();
  const foodsSeeded = await seedFoods();
  const nutritionSeeded = await seedNutritionLogsAndGoal();
  const mealsSeeded = await seedMeals();

  const workoutData = await seedWorkoutTemplatesAndHistory();
  const userMetricsSeeded = await seedUserMetrics();
  await seedMenstrualCycle();
  const chatSeeded = await seedChatHistory();

  // Set default navigation bar slots with Coach as the last item
  await SettingsService.setNavSlot(1, 'workouts');
  await SettingsService.setNavSlot(2, 'food');
  await SettingsService.setNavSlot(3, 'coach');
  console.log('Set default navigation bar slots: workouts, food, coach');

  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETED, 'true'],
    // TODO: we might not want to force it to be the current version
    [ONBOARDING_VERSION, CURRENT_ONBOARDING_VERSION],
  ]);

  // Seed Gemini AI settings
  await SettingsService.setEnableGoogleGemini(true);
  await SettingsService.setGoogleGeminiApiKey('dev-gemini-api-key-12345');
  console.log('Seeded Gemini AI settings: enabled=true, apiKey=dev-gemini-api-key-12345');

  console.log(
    `Dev data seeding complete. User: ${userSeeded ? 'seeded' : 'skipped'}, Exercises: ${exercisesSeeded ? 'seeded' : 'skipped'}, Workout Templates: ${workoutData.templatesCreated}, Workout History: ${workoutData.workoutsCreated} workouts, User Metrics: ${userMetricsSeeded.created} metrics, Foods: ${foodsSeeded.created} foods, Nutrition logs: ${nutritionSeeded.created}, Meals: ${mealsSeeded.created} meals, Chat messages: ${chatSeeded.created}`
  );

  return (
    userSeeded ||
    exercisesSeeded ||
    workoutData.templatesCreated > 0 ||
    workoutData.workoutsCreated > 0 ||
    userMetricsSeeded.created > 0 ||
    foodsSeeded.created > 0 ||
    nutritionSeeded.created > 0 ||
    mealsSeeded.created > 0 ||
    chatSeeded.created > 0
  );
}
