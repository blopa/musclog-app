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
import { loadExercisesFromJson } from './dev';

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

// TODO: move this somewhere else, like in the boot, right after the database is created.
if (__DEV__) {
  (async () => await loadExercisesFromJson())();
}

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
