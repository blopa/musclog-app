/**
 * Database instance for the app.
 * This file is separate from index.ts to avoid require cycles.
 * Models that need the database instance should import from this file.
 * ALWAYS IMPORT FROM THIS FILE AND NOT FROM INDEX.
 */

import { Database } from '@nozbe/watermelondb';

import adapter from './adapter';
// Import all models
import AiCustomPrompt from './models/AiCustomPrompt';
import ChatMessage from './models/ChatMessage';
import DebugDump from './models/DebugDump';
import Exercise from './models/Exercise';
import ExerciseGoal from './models/ExerciseGoal';
import ExerciseMuscle from './models/ExerciseMuscle';
import Food from './models/Food';
import FoodFoodPortion from './models/FoodFoodPortion';
import FoodPortion from './models/FoodPortion';
import Meal from './models/Meal';
import MealFood from './models/MealFood';
import MenstrualCycle from './models/MenstrualCycle';
import Muscle from './models/Muscle';
import NutritionCheckin from './models/NutritionCheckin';
import NutritionGoal from './models/NutritionGoal';
import NutritionLog from './models/NutritionLog';
import SavedForLaterGroup from './models/SavedForLaterGroup';
import SavedForLaterItem from './models/SavedForLaterItem';
import Schedule from './models/Schedule';
import Setting from './models/Setting';
import Supplement from './models/Supplement';
import User from './models/User';
import UserMetric from './models/UserMetric';
import UserMetricsNote from './models/UserMetricsNote';
import WorkoutLog from './models/WorkoutLog';
import WorkoutLogExercise from './models/WorkoutLogExercise';
import WorkoutLogSet from './models/WorkoutLogSet';
import WorkoutTemplate from './models/WorkoutTemplate';
import WorkoutTemplateExercise from './models/WorkoutTemplateExercise';
import WorkoutTemplateSet from './models/WorkoutTemplateSet';

// Create database instance
// This file is separate from index.ts to avoid require cycles
// Models that need the database instance should import from this file
export const database = new Database({
  adapter,
  modelClasses: [
    AiCustomPrompt,
    Exercise,
    ExerciseGoal,
    ExerciseMuscle,
    UserMetric,
    UserMetricsNote,
    User,
    MenstrualCycle,
    Setting,
    WorkoutTemplate,
    WorkoutTemplateExercise,
    Schedule,
    WorkoutTemplateSet,
    WorkoutLog,
    WorkoutLogExercise,
    WorkoutLogSet,
    NutritionGoal,
    NutritionCheckin,
    Food,
    FoodPortion,
    FoodFoodPortion,
    Meal,
    MealFood,
    Muscle,
    NutritionLog,
    SavedForLaterGroup,
    SavedForLaterItem,
    ChatMessage,
    DebugDump,
    Supplement,
  ],
});
