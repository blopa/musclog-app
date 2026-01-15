import { Database } from '@nozbe/watermelondb';
import adapter from './adapter';

// Import all models
import Exercise from './models/Exercise';
import UserMetric from './models/UserMetric';
import WorkoutTemplate from './models/WorkoutTemplate';
import Schedule from './models/Schedule';
import WorkoutTemplateSet from './models/WorkoutTemplateSet';
import WorkoutLog from './models/WorkoutLog';
import WorkoutLogSet from './models/WorkoutLogSet';

// Create database instance
export const database = new Database({
  adapter,
  modelClasses: [
    Exercise,
    UserMetric,
    WorkoutTemplate,
    Schedule,
    WorkoutTemplateSet,
    WorkoutLog,
    WorkoutLogSet,
  ],
});

// Export models for convenience
export {
  Exercise,
  UserMetric,
  WorkoutTemplate,
  Schedule,
  WorkoutTemplateSet,
  WorkoutLog,
  WorkoutLogSet,
};
