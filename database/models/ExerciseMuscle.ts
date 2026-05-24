import { Model, type Relation } from '@nozbe/watermelondb';
import { field, immutableRelation } from '@nozbe/watermelondb/decorators';

import Exercise from './Exercise';
import Muscle from './Muscle';

export type MuscleRole = 'primary' | 'secondary';

export default class ExerciseMuscle extends Model {
  static table = 'exercise_muscles';

  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
    muscles: { type: 'belongs_to' as const, key: 'muscle_id' },
  };

  @field('exercise_id') declare exerciseId: string;
  @field('muscle_id') declare muscleId: string;
  @field('role') declare role: MuscleRole;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @immutableRelation('exercises', 'exercise_id') declare exercise: Relation<Exercise>;
  @immutableRelation('muscles', 'muscle_id') declare muscle: Relation<Muscle>;
}
