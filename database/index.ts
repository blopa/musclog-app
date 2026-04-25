// Re-export database instance from database-instance.ts
// This file exists to maintain backward compatibility and break require cycles
// Models that need the database should import from './database-instance' instead
export { database } from './database-instance';

// Export models for convenience
export { default as ChatMessage } from './models/ChatMessage';
export { default as DebugDump } from './models/DebugDump';
export { default as Exercise } from './models/Exercise';
export { default as NutritionGoal } from './models/NutritionGoal';
export { default as Schedule } from './models/Schedule';
export { default as Setting } from './models/Setting';
export { default as User } from './models/User';
export { default as UserMetric } from './models/UserMetric';
export { default as WorkoutLog } from './models/WorkoutLog';
export { default as WorkoutLogSet } from './models/WorkoutLogSet';
export { default as WorkoutTemplate } from './models/WorkoutTemplate';
export { default as WorkoutTemplateSet } from './models/WorkoutTemplateSet';

// Export repositories for query methods
export { ScheduleRepository } from './repositories/ScheduleRepository';
export { WorkoutLogRepository } from './repositories/WorkoutLogRepository';
export { WorkoutTemplateRepository } from './repositories/WorkoutTemplateRepository';
