import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ field, condition }),
    eq: (value: unknown) => value,
    sortBy: (field: string) => ({ kind: 'sortBy', field }),
    asc: 'asc',
  },
}));
jest.mock('@/database/models/Gym', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getActiveGymId: jest.fn(), setActiveGymId: jest.fn() },
}));

jest.mock('@/database/database-instance', () => {
  const state = { rows: [] as any[] };
  const decorate = (row: any) => {
    row.update = jest.fn(async (updater: (r: any) => void) => updater(row));
    row.markAsDeleted = jest.fn(async () => {
      row.deletedAt = Date.now();
    });
    return row;
  };
  const database = {
    get: () => ({
      query: () => ({ fetch: async () => state.rows.filter((row) => !row.deletedAt) }),
      find: async (id: string) => {
        const row = state.rows.find((candidate) => candidate.id === id);
        if (!row) throw new Error('not found');
        return row;
      },
      create: async (builder: (r: any) => void) => {
        const row = decorate({ id: `gym-${state.rows.length + 1}` });
        builder(row);
        state.rows.push(row);
        return row;
      },
    }),
    write: async (callback: () => Promise<unknown>) => callback(),
  };
  return { __esModule: true, database, mockState: state, decorate };
});

const { mockState, decorate } = jest.requireMock('@/database/database-instance') as {
  mockState: { rows: any[] };
  decorate: (row: any) => any;
};
const settings = SettingsService as jest.Mocked<typeof SettingsService>;

const input = {
  name: '  Home Gym  ',
  barWeightKg: 15,
  plates: [
    { weightKg: 10, count: 4 },
    { weightKg: 2.5, count: 4 },
  ],
  weightIncrementKg: 1,
  equipment: ['barbell', 'dumbbell'] as const,
  weightUnit: 'kg' as const,
};

beforeEach(() => {
  mockState.rows = [];
  jest.clearAllMocks();
  settings.getActiveGymId.mockResolvedValue(null);
});

describe('GymService.createGym', () => {
  it('stores the gym in kilograms with its lists serialized, and returns a parsed snapshot', async () => {
    const snapshot = await GymService.createGym(input);

    expect(mockState.rows[0]).toMatchObject({
      name: 'Home Gym',
      barWeightKg: 15,
      weightIncrementKg: 1,
      weightUnit: 'kg',
    });
    expect(JSON.parse(mockState.rows[0].platesJson)).toEqual(input.plates);
    expect(snapshot).toMatchObject({
      name: 'Home Gym',
      barWeightKg: 15,
      plates: [
        { weightKg: 10, count: 4 },
        { weightKg: 2.5, count: 4 },
      ],
      equipment: ['barbell', 'dumbbell'],
    });
  });

  it('normalizes every gym weight at the shared seven-decimal storage boundary', async () => {
    await GymService.createGym({
      ...input,
      barWeightKg: 20.4116566123,
      plates: [{ weightKg: 3.061746803, count: 2 }],
      weightIncrementKg: 2.2679618501,
    });

    expect(mockState.rows[0]).toMatchObject({
      barWeightKg: 20.4116566,
      weightIncrementKg: 2.2679619,
    });
    expect(JSON.parse(mockState.rows[0].platesJson)).toEqual([{ weightKg: 3.0617468, count: 2 }]);
  });

  it('only makes the new gym active when asked', async () => {
    await GymService.createGym(input);
    expect(settings.setActiveGymId).not.toHaveBeenCalled();

    const snapshot = await GymService.createGym(input, { makeActive: true });
    expect(settings.setActiveGymId).toHaveBeenCalledWith(snapshot.id);
  });

  it('names an unnamed gym and clamps nonsense numbers', async () => {
    await GymService.createGym({ ...input, name: '   ', barWeightKg: -5, weightIncrementKg: 0 });

    expect(mockState.rows[0]).toMatchObject({
      name: 'Gym',
      barWeightKg: 0,
      weightIncrementKg: 2.5,
    });
  });
});

describe('GymService weight unit', () => {
  it('stores no unit when the user pinned none, so the gym follows the account', async () => {
    const snapshot = await GymService.createGym({ ...input, weightUnit: null });

    expect(mockState.rows[0].weightUnit).toBeUndefined();
    expect(snapshot.weightUnit).toBeUndefined();
  });

  it('clears a pinned unit when it is set back to the account setting', async () => {
    const { id } = await GymService.createGym({ ...input, weightUnit: 'lbs' });
    expect(mockState.rows[0].weightUnit).toBe('lbs');

    await GymService.updateGym(id, { ...input, weightUnit: null });

    expect(mockState.rows[0].weightUnit).toBeUndefined();
  });
});

describe('GymService.getActiveGym', () => {
  it('returns the selected gym', async () => {
    const created = await GymService.createGym(input);
    settings.getActiveGymId.mockResolvedValue(created.id);

    expect((await GymService.getActiveGym())?.name).toBe('Home Gym');
  });

  it('returns null when none is selected, or when the selected one was deleted', async () => {
    expect(await GymService.getActiveGym()).toBeNull();

    const created = await GymService.createGym(input);
    settings.getActiveGymId.mockResolvedValue(created.id);
    mockState.rows[0].deletedAt = 5;
    expect(await GymService.getActiveGym()).toBeNull();
  });
});

describe('GymService.updateGym', () => {
  it('rewrites the stored fields', async () => {
    const { id } = await GymService.createGym(input);

    await GymService.updateGym(id, {
      ...input,
      name: 'Garage',
      plates: [{ weightKg: 20, count: 2 }],
    });

    expect(mockState.rows[0].name).toBe('Garage');
    expect(JSON.parse(mockState.rows[0].platesJson)).toEqual([{ weightKg: 20, count: 2 }]);
  });

  it('refuses a deleted gym', async () => {
    const { id } = await GymService.createGym(input);
    mockState.rows[0].deletedAt = 5;

    await expect(GymService.updateGym(id, input)).rejects.toThrow('deleted gym');
  });
});

describe('GymService.deleteGym', () => {
  it('soft-deletes through the model writer and stops using the active gym', async () => {
    const { id } = await GymService.createGym(input);
    settings.getActiveGymId.mockResolvedValue(id);

    await GymService.deleteGym(id);

    expect(mockState.rows[0].markAsDeleted).toHaveBeenCalledTimes(1);
    expect(settings.setActiveGymId).toHaveBeenCalledWith(null);
  });

  it('leaves the active selection alone when a different gym is deleted', async () => {
    const { id } = await GymService.createGym(input);
    settings.getActiveGymId.mockResolvedValue('some-other-gym');

    await GymService.deleteGym(id);

    expect(settings.setActiveGymId).not.toHaveBeenCalled();
  });
});

describe('GymService.removeEquipment', () => {
  it('removes just that equipment type', async () => {
    const { id } = await GymService.createGym({
      ...input,
      equipment: ['barbell', 'cable', 'dumbbell'],
    });

    await GymService.removeEquipment(id, 'cable');

    expect(JSON.parse(mockState.rows[0].equipmentJson)).toEqual(['barbell', 'dumbbell']);
  });

  it('is harmless for equipment the gym never had', async () => {
    const { id } = await GymService.createGym(input);

    await GymService.removeEquipment(id, 'cable');

    expect(JSON.parse(mockState.rows[0].equipmentJson)).toEqual(['barbell', 'dumbbell']);
  });
});

// Keep `decorate` referenced so a refactor of the fake cannot silently drop the writer spies.
test('the fake database decorates rows with writer spies', () => {
  expect(decorate({}).markAsDeleted).toBeDefined();
});
