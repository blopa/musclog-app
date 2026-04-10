/**
 * Zod schemas for validating database export/import data.
 * These ensure data integrity and prevent corruption from malformed imports.
 */

import { z } from 'zod';

// Base timestamp schema (milliseconds since epoch)
const timestampSchema = z.number().int().min(0);

// Optional timestamp that can be null
const optionalTimestampSchema = z.number().int().min(0).nullable().optional();

// UUID-like string pattern (simplified, allows any string for flexibility)
const idSchema = z.string().min(1).max(100);

// Optional ID
const optionalIdSchema = z.string().min(1).max(100).optional();

// Exercise schema
export const ExerciseSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  image_url: z.string().max(500).optional().nullable(),
  muscle_group: z.string().max(100),
  equipment_type: z.string().max(100),
  mechanic_type: z.enum(['compound', 'isolation']).optional().nullable(),
  source: z.enum(['app', 'user']).optional().nullable(),
  load_multiplier: z.number().default(1),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Template schema
export const WorkoutTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  workout_insights_type: z.string().max(100).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  type: z.string().max(100).optional().nullable(),
  week_days_json: z.string().optional().nullable(),
  is_archived: z.boolean().default(false),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Schedule schema
export const ScheduleSchema = z.object({
  id: idSchema,
  template_id: idSchema,
  day_of_week: z.enum([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]),
  reminder_time: z.string().max(10).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Template Exercise schema
export const WorkoutTemplateExerciseSchema = z.object({
  id: idSchema,
  template_id: idSchema,
  exercise_id: idSchema,
  notes: z.string().max(2000).optional().nullable(),
  exercise_order: z.number().int().min(0),
  group_id: optionalIdSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Template Set schema
export const WorkoutTemplateSetSchema = z.object({
  id: idSchema,
  template_exercise_id: idSchema,
  target_reps: z.number().int().min(0),
  target_weight: z.number().min(0),
  rest_time_after: z.number().int().min(0).optional().nullable(),
  set_order: z.number().int().min(0),
  is_drop_set: z.boolean().default(false),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Log schema
export const WorkoutLogSchema = z.object({
  id: idSchema,
  template_id: optionalIdSchema,
  external_id: optionalIdSchema,
  workout_name: z.string().min(1).max(200),
  started_at: timestampSchema,
  completed_at: optionalTimestampSchema,
  total_volume: z.number().min(0).optional().nullable(),
  calories_burned: z.number().min(0).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  type: z.string().max(100).optional().nullable(),
  exhaustion_level: z.number().int().min(0).max(10).default(0),
  workout_score: z.number().int().min(0).max(10).default(0),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Log Exercise schema
export const WorkoutLogExerciseSchema = z.object({
  id: idSchema,
  workout_log_id: idSchema,
  exercise_id: idSchema,
  template_exercise_id: optionalIdSchema,
  notes: z.string().max(2000).optional().nullable(),
  exercise_order: z.number().int().min(0),
  group_id: optionalIdSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Workout Log Set schema
export const WorkoutLogSetSchema = z.object({
  id: idSchema,
  log_exercise_id: idSchema,
  reps: z.number().int().min(0),
  weight: z.number().min(0),
  partials: z.number().int().min(0).optional().nullable(),
  rest_time_after: z.number().int().min(0).default(0),
  reps_in_reserve: z.number().int().min(0).default(0),
  is_skipped: z.boolean().default(false),
  difficulty_level: z.number().int().min(0).max(10).default(0),
  is_drop_set: z.boolean().default(false),
  set_order: z.number().int().min(0),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Food schema
export const FoodSchema = z.object({
  id: idSchema,
  is_ai_generated: z.boolean().default(false),
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  calories: z.number().min(0).default(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  fiber: z.number().min(0).default(0),
  external_id: optionalIdSchema,
  micros_json: z.string().max(5000).optional().nullable(),
  is_favorite: z.boolean().default(false),
  source: z.enum(['user', 'usda', 'ai', 'openfood', 'foundation']).optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Food Portion schema
export const FoodPortionSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  gram_weight: z.number().min(0),
  icon: z.string().max(50).optional().nullable(),
  source: z.enum(['app', 'user']).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Food-Food Portion junction schema
export const FoodFoodPortionSchema = z.object({
  id: idSchema,
  food_id: idSchema,
  food_portion_id: idSchema,
  is_default: z.boolean().default(false),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Meal schema
export const MealSchema = z.object({
  id: idSchema,
  is_ai_generated: z.boolean().default(false),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  is_favorite: z.boolean().default(false),
  prepared_weight_grams: z.number().min(0).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Meal Food schema
export const MealFoodSchema = z.object({
  id: idSchema,
  meal_id: idSchema,
  food_id: idSchema,
  amount: z.number().min(0),
  portion_id: optionalIdSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Nutrition Log schema
export const NutritionLogSchema = z.object({
  id: idSchema,
  food_id: idSchema,
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']),
  external_id: optionalIdSchema,
  amount: z.number().min(0),
  portion_id: optionalIdSchema,
  logged_food_name: z.string().max(200).optional().nullable(),
  logged_calories: z.string().max(100).default('0'),
  logged_protein: z.string().max(100).default('0'),
  logged_carbs: z.string().max(100).default('0'),
  logged_fat: z.string().max(100).default('0'),
  logged_fiber: z.string().max(100).default('0'),
  logged_micros_json: z.string().max(5000).optional().nullable(),
  date: timestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// User Metrics schema
export const UserMetricSchema = z.object({
  id: idSchema,
  type: z.string().max(50),
  external_id: optionalIdSchema,
  value: z.string().max(100),
  unit: z.string().max(20).optional().nullable(),
  date: timestampSchema,
  timezone: z.string().max(50),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// User Metrics Note schema
export const UserMetricNoteSchema = z.object({
  id: idSchema,
  user_metric_id: idSchema,
  note: z.string().max(5000),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Menstrual Cycle schema
export const MenstrualCycleSchema = z.object({
  id: idSchema,
  avg_cycle_length: z.number().int().min(1).max(100).default(28),
  avg_period_duration: z.number().int().min(1).max(30).default(5),
  use_hormonal_birth_control: z.boolean().default(false),
  birth_control_type: z.string().max(50).optional().nullable(),
  last_period_start_date: timestampSchema,
  sync_goal: z.enum(['performance', 'symptoms', 'energy']).optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Setting schema
export const SettingSchema = z.object({
  id: idSchema,
  type: z.string().min(1).max(100),
  value: z.string().max(2000),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// User schema
export const UserSchema = z.object({
  id: idSchema,
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().nullable(),
  date_of_birth: timestampSchema,
  gender: z.enum(['male', 'female', 'other']),
  fitness_goal: z.string().max(50),
  weight_goal: z.enum(['lose', 'gain', 'maintain']).optional().nullable(),
  activity_level: z.number().int().min(1).max(5),
  lifting_experience: z.enum(['beginner', 'intermediate', 'advanced']),
  avatar_icon: z.string().max(50).optional().nullable(),
  avatar_color: z.string().max(50).optional().nullable(),
  sync_id: z.string().min(1).max(100),
  external_account_id: optionalIdSchema,
  external_account_provider: z.string().max(50).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Nutrition Goal schema
export const NutritionGoalSchema = z.object({
  id: idSchema,
  total_calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fats: z.number().min(0),
  fiber: z.number().min(0),
  eating_phase: z.enum(['cut', 'maintain', 'bulk']),
  target_weight: z.number().min(0),
  target_body_fat: z.number().min(0).max(100),
  target_bmi: z.number().min(0),
  target_ffmi: z.number().min(0),
  target_date: optionalTimestampSchema,
  effective_until: optionalTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Nutrition Checkin schema
export const NutritionCheckinSchema = z.object({
  id: idSchema,
  nutrition_goal_id: idSchema,
  checkin_date: timestampSchema,
  target_weight: z.number().min(0),
  target_body_fat: z.number().min(0).max(100),
  target_bmi: z.number().min(0),
  target_ffmi: z.number().min(0),
  status: z.string().max(50).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Chat Message schema
export const ChatMessageSchema = z.object({
  id: idSchema,
  sender: z.enum(['user', 'coach']),
  message: z.string().max(10000),
  message_type: z.string().max(50).default('text'),
  context: z.enum(['nutrition', 'exercise', 'general']).default('general'),
  payload_json: z.string().max(10000).optional().nullable(),
  summarized_message: z.string().max(2000).optional().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// AI Custom Prompt schema
export const AiCustomPromptSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  content: z.string().max(5000),
  context: z.enum(['nutrition', 'exercise', 'general']),
  type: z.enum(['system', 'memory']),
  is_active: z.boolean().default(true),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: optionalTimestampSchema,
});

// Export dump schema
export const ExportDumpSchema = z.object({
  _exportVersion: z.number().int().min(1).max(1000),
  exercises: z.array(ExerciseSchema).optional(),
  workout_templates: z.array(WorkoutTemplateSchema).optional(),
  schedules: z.array(ScheduleSchema).optional(),
  workout_template_exercises: z.array(WorkoutTemplateExerciseSchema).optional(),
  workout_template_sets: z.array(WorkoutTemplateSetSchema).optional(),
  workout_logs: z.array(WorkoutLogSchema).optional(),
  workout_log_exercises: z.array(WorkoutLogExerciseSchema).optional(),
  workout_log_sets: z.array(WorkoutLogSetSchema).optional(),
  foods: z.array(FoodSchema).optional(),
  food_portions: z.array(FoodPortionSchema).optional(),
  food_food_portions: z.array(FoodFoodPortionSchema).optional(),
  meals: z.array(MealSchema).optional(),
  meal_foods: z.array(MealFoodSchema).optional(),
  nutrition_logs: z.array(NutritionLogSchema).optional(),
  user_metrics: z.array(UserMetricSchema).optional(),
  user_metrics_notes: z.array(UserMetricNoteSchema).optional(),
  menstrual_cycles: z.array(MenstrualCycleSchema).optional(),
  settings: z.array(SettingSchema).optional(),
  users: z.array(UserSchema).optional(),
  nutrition_goals: z.array(NutritionGoalSchema).optional(),
  nutrition_checkins: z.array(NutritionCheckinSchema).optional(),
  chat_messages: z.array(ChatMessageSchema).optional(),
  ai_custom_prompts: z.array(AiCustomPromptSchema).optional(),
  _async_storage_: z.record(z.string(), z.string().nullable()).optional(),
});

// Type exports for TypeScript
export type ValidatedExportDump = z.infer<typeof ExportDumpSchema>;
