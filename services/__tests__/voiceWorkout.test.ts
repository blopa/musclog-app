import { findSpokenWorkout } from '@/services/voiceWorkout';

const mockActive = jest.fn();
const mockTemplates = jest.fn();
const mockPlans = jest.fn();
const mockUpcoming = jest.fn();
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { getActiveWorkout: (...args: unknown[]) => mockActive(...args) },
}));
jest.mock('@/database/repositories/WorkoutTemplateRepository', () => ({
  WorkoutTemplateRepository: { getActive: () => ({ fetch: mockTemplates }) },
}));
jest.mock('@/database/services/WorkoutPlanService', () => ({
  WorkoutPlanService: { getPlansWithMemberships: (...args: unknown[]) => mockPlans(...args) },
}));
jest.mock('@/database/repositories/WorkoutTodayRepository', () => ({
  WorkoutTodayRepository: { upcoming: (...args: unknown[]) => mockUpcoming(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockActive.mockResolvedValue(null);
  mockTemplates.mockResolvedValue([
    { id: 'a', name: 'Push' },
    { id: 'b', name: 'Pull' },
  ]);
  mockPlans.mockResolvedValue([
    { plan: { id: 'p', name: 'Strength' }, memberships: [{ templateId: 'a' }] },
  ]);
  mockUpcoming.mockResolvedValue([]);
});

it('resumes an active workout without reading templates', async () => {
  mockActive.mockResolvedValue({ id: 'log' });
  await expect(findSpokenWorkout('start push')).resolves.toEqual({
    kind: 'active',
    workoutLogId: 'log',
  });
  expect(mockTemplates).not.toHaveBeenCalled();
});

it('finds a named workout and includes its plan', async () => {
  await expect(findSpokenWorkout('start push')).resolves.toEqual({
    kind: 'found',
    workout: { templateId: 'a', name: 'Push', planId: 'p', planName: 'Strength' },
  });
});

it('offers the first unfinished workout today for a generic request', async () => {
  mockUpcoming.mockResolvedValue([
    { completedToday: true },
    {
      completedToday: false,
      template: { id: 'b', name: 'Pull' },
      planId: 'p',
      planName: 'Strength',
    },
  ]);
  await expect(findSpokenWorkout('start my workout')).resolves.toEqual({
    kind: 'choose',
    workouts: [{ templateId: 'b', name: 'Pull', planId: 'p', planName: 'Strength' }],
  });
});

it('offers all workouts for an unknown name and avoids today lookup', async () => {
  const result = await findSpokenWorkout('start legs');
  expect(result).toEqual({
    kind: 'choose',
    workouts: [
      { templateId: 'a', name: 'Push', planId: 'p', planName: 'Strength' },
      { templateId: 'b', name: 'Pull' },
    ],
  });
  expect(mockUpcoming).not.toHaveBeenCalled();
});

it('reports no saved workouts', async () => {
  mockTemplates.mockResolvedValue([]);
  await expect(findSpokenWorkout('start my workout')).resolves.toEqual({ kind: 'none' });
});
