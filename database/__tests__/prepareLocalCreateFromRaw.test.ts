import { type Database } from '@nozbe/watermelondb';
import Collection from '@nozbe/watermelondb/Collection';

import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { prepareLocalCreateFromRaw } from '@/database/prepareLocalCreateFromRaw';
import { schema } from '@/database/schema';

describe('prepareLocalCreateFromRaw', () => {
  it('creates a schema-shaped workout set without assigning to computed model properties', () => {
    const collection = new Collection<WorkoutLogSet>(
      { schema } as Database,
      WorkoutLogSet as unknown as WorkoutLogSet
    );

    const set = prepareLocalCreateFromRaw(collection, {
      id: 'set-1',
      _status: 'synced',
      _changed: 'reps',
      log_exercise_id: 'exercise-1',
      reps: 10,
      weight: 100,
      partials: null,
      rest_time_after: 60,
      reps_in_reserve: 2,
      completion_status: 'skipped',
      difficulty_level: null,
      is_skipped: true,
      set_type: 'normal',
      set_order: 1,
      rep_data_json: '[]',
      created_at: 1,
      updated_at: 2,
      deleted_at: null,
      unknown_model_property: 'ignored',
    });

    expect(set.id).toBe('set-1');
    expect(set.createdAt).toBe(1);
    expect(set.updatedAt).toBe(2);
    expect(set.completionStatus).toBe('skipped');
    expect(set.isSkipped).toBe(true);
    expect(set.legacyIsSkipped).toBe(true);
    expect(set.repDataJson).toEqual([]);
    expect(set._raw).toMatchObject({ _changed: '', _status: 'created', is_skipped: true });
    expect(set._raw).not.toHaveProperty('unknown_model_property');
    expect(set).not.toHaveProperty('unknown_model_property');
  });
});
