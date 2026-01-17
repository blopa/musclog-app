// Re-export database instance from database-instance.ts
// This file exists to maintain backward compatibility and break require cycles
// Models that need the database should import from './database-instance' instead
export { database } from './database-instance';

// Export models for convenience
export { default as Exercise } from './models/Exercise';
export { default as UserMetric } from './models/UserMetric';
export { default as User } from './models/User';
export { default as Setting } from './models/Setting';
export { default as WorkoutTemplate } from './models/WorkoutTemplate';
export { default as Schedule } from './models/Schedule';
export { default as WorkoutTemplateSet } from './models/WorkoutTemplateSet';
export { default as WorkoutLog } from './models/WorkoutLog';
export { default as WorkoutLogSet } from './models/WorkoutLogSet';

// Export repositories for query methods
export { WorkoutTemplateRepository } from './repositories/WorkoutTemplateRepository';
export { ScheduleRepository } from './repositories/ScheduleRepository';
export { WorkoutLogRepository } from './repositories/WorkoutLogRepository';
