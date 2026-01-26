import { Database } from '@nozbe/watermelondb';
import adapter from './adapter';

// Import all models
import Exercise from './models/Exercise';
import UserMetric from './models/UserMetric';
import User from './models/User';
import Setting from './models/Setting';
import WorkoutTemplate from './models/WorkoutTemplate';
import Schedule from './models/Schedule';
import WorkoutTemplateSet from './models/WorkoutTemplateSet';
import WorkoutLog from './models/WorkoutLog';
import WorkoutLogSet from './models/WorkoutLogSet';
import NutritionGoal from './models/NutritionGoal';
import Food from './models/Food';
import FoodPortion from './models/FoodPortion';
import Meal from './models/Meal';
import MealFood from './models/MealFood';
import NutritionLog from './models/NutritionLog';

// Create database instance
// This file is separate from index.ts to avoid require cycles
// Models that need the database instance should import from this file
export const database = new Database({
  adapter,
  modelClasses: [
    Exercise,
    UserMetric,
    User,
    Setting,
    WorkoutTemplate,
    Schedule,
    WorkoutTemplateSet,
    WorkoutLog,
    WorkoutLogSet,
    NutritionGoal,
    Food,
    FoodPortion,
    Meal,
    MealFood,
    NutritionLog,
  ],
});
