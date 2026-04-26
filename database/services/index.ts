// Export all nutrition tracking services
export { FoodPortionService } from './FoodPortionService';
export { FoodService } from './FoodService';
export { MealService } from './MealService';
export { NutritionService, scaleMealNutritionLogsToTotalGrams } from './NutritionService';
export { SavedForLaterService } from './SavedForLaterService';

// Export exercise service
export { ExerciseService } from './ExerciseService';
export { MUSCLE_SEED_DATA, MuscleService } from './MuscleService';

// Export chat service
export { ChatService } from './ChatService';
export { DebugDumpService } from './DebugDumpService';

// Export AI custom prompt service
export { AiCustomPromptService } from './AiCustomPromptService';

// Export existing services
export { ExerciseGoalService } from './ExerciseGoalService';
export {
  type MigrateAllOptions,
  type MigrationProgressInfo,
  MigrationService,
  type MigrationStepKey,
} from './MigrationService';
export { NutritionCheckinService } from './NutritionCheckinService';
export { NutritionGoalService } from './NutritionGoalService';
export { ProgressService } from './ProgressService';
export { SettingsService } from './SettingsService';
export { SupplementService } from './SupplementService';
export { UserMetricService } from './UserMetricService';
export { UserService } from './UserService';
export { WorkoutAnalytics } from './WorkoutAnalytics';
export { type EnrichedWorkoutLogSet, WorkoutService } from './WorkoutService';
export { WorkoutTemplateService } from './WorkoutTemplateService';
