import { Database } from '@nozbe/watermelondb';
import adapter from './adapter';

// Import all models
import Workout from './models/Workout';
import WorkoutSession from './models/WorkoutSession';
import Exercise from './models/Exercise';
import WorkoutExercise from './models/WorkoutExercise';
import Set from './models/Set';
import FoodLog from './models/FoodLog';
import UserMetric from './models/UserMetric';

// Create database instance
export const database = new Database({
  adapter,
  modelClasses: [Workout, WorkoutSession, Exercise, WorkoutExercise, Set, FoodLog, UserMetric],
});

// Export models for convenience
export { Workout, WorkoutSession, Exercise, WorkoutExercise, Set, FoodLog, UserMetric };
