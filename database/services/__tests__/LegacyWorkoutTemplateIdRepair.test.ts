import { LegacyWorkoutTemplateIdRepair } from '@/database/services/LegacyWorkoutTemplateIdRepair';

type Row = Record<string, unknown>;

const mockTables: Record<string, Row[]> = {};

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    notEq: jest.fn((value: unknown) => value),
  },
}));
jest.mock('@/database/commitPrepared', () => ({
  commitPrepared: async (_db: unknown, _existing: unknown[], prepare: () => unknown[]) => {
    prepare();
  },
}));
jest.mock('@/database/database-instance', () => ({
  database: {
    write: async <T>(work: () => Promise<T>) => work(),
    get: (table: string) => ({ query: () => ({ fetch: async () => mockTables[table] }) }),
  },
}));

const template = (id: string, name: string, deletedAt: number | null = null) => ({
  id,
  name,
  deletedAt,
});

const log = (id: string, templateId: string, workoutName: string) => {
  const row: Row = { id, templateId, workoutName };
  row.prepareUpdate = (apply: (record: Row) => void) => {
    apply(row);
    return row;
  };
  return row;
};

beforeEach(() => {
  mockTables.workout_templates = [];
  mockTables.workout_logs = [];
});

describe('LegacyWorkoutTemplateIdRepair', () => {
  it('points a log with a 1.x numeric template id at the one live template of its name', async () => {
    mockTables.workout_templates = [template('tpl-a', 'Push Day'), template('tpl-b', 'Pull Day')];
    const legacy = log('log-1', '8', 'Push Day');
    mockTables.workout_logs = [legacy];

    expect(await LegacyWorkoutTemplateIdRepair.run()).toBe(1);
    expect(legacy.templateId).toBe('tpl-a');
  });

  it('leaves a log alone when its template id names a real template, deleted or not', async () => {
    mockTables.workout_templates = [
      template('tpl-a', 'Push Day'),
      template('tpl-old', 'Push Day', 5),
    ];
    const live = log('log-1', 'tpl-a', 'Push Day');
    const ofDeleted = log('log-2', 'tpl-old', 'Push Day');
    mockTables.workout_logs = [live, ofDeleted];

    expect(await LegacyWorkoutTemplateIdRepair.run()).toBe(0);
    expect(live.templateId).toBe('tpl-a');
    expect(ofDeleted.templateId).toBe('tpl-old');
  });

  it('does not guess between live templates that share the name', async () => {
    mockTables.workout_templates = [template('tpl-a', 'Push Day'), template('tpl-b', 'Push Day')];
    const legacy = log('log-1', '8', 'Push Day');
    mockTables.workout_logs = [legacy];

    expect(await LegacyWorkoutTemplateIdRepair.run()).toBe(0);
    expect(legacy.templateId).toBe('8');
  });

  it('does not attach a log to a deleted template or to a name nobody has', async () => {
    mockTables.workout_templates = [template('tpl-old', 'Push Day', 5)];
    const legacy = log('log-1', '8', 'Push Day');
    const stranger = log('log-2', '9', 'Something Else');
    mockTables.workout_logs = [legacy, stranger];

    expect(await LegacyWorkoutTemplateIdRepair.run()).toBe(0);
    expect(legacy.templateId).toBe('8');
    expect(stranger.templateId).toBe('9');
  });
});
