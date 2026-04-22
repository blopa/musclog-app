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

  @field('exercise_id') exerciseId!: string;
  @field('muscle_id') muscleId!: string;
  @field('role') role!: MuscleRole;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @immutableRelation('exercises', 'exercise_id') exercise!: Relation<Exercise>;
  @immutableRelation('muscles', 'muscle_id') muscle!: Relation<Muscle>;
}
