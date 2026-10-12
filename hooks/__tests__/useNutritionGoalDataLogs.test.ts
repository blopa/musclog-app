import { renderHook, waitFor } from '@testing-library/react';
import { useNutritionGoalDataLogs } from '@/hooks/useNutritionGoalDataLogs';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';

jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getGoalsHistory: jest.fn() },
}));
jest.mock('@/database/services/NutritionTargetService', () => ({
  NutritionTargetService: { resolve: jest.fn() },
}));
jest.mock('@/database/models/NutritionGoal', () => ({ __esModule: true, default: class {} }));
jest.mock('@/hooks/useDateFnsLocale', () => ({
  useDateFnsLocale: () => require('date-fns/locale').enUS,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { status: { purple: 'purple', purple10: 'lightpurple' } } }),
}));
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

it('shows resolved weekly targets in the goal list and resolves archived goals at their historical date', async () => {
  const current = {
    id: 'current',
    createdAt: Date.now(),
    effectiveUntil: null,
    totalCalories: 2100,
    targetMode: 'weekly',
    eatingPhase: 'maintain',
  };
  const archived = {
    ...current,
    id: 'archived',
    createdAt: Date.now() - 86400000,
    effectiveUntil: Date.now(),
  };
  jest.mocked(NutritionGoalService.getGoalsHistory).mockResolvedValue([current, archived] as any);
  jest.mocked(NutritionTargetService.resolve).mockImplementation(
    async (goal) =>
      ({
        totalCalories: goal.id === 'current' ? 2300 : 2100,
        mode: 'weekly',
        isDynamic: false,
      }) as any
  );
  const hook = renderHook(() => useNutritionGoalDataLogs());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  const items = hook.result.current.dayGroups.flatMap((g) => g.items);
  expect(items.find((i) => i.id === 'current')?.goalCalories).toBe(2300);
  expect(items.find((i) => i.id === 'archived')?.goalCalories).toBe(2100);
  expect(NutritionTargetService.resolve).toHaveBeenCalledWith(
    archived,
    new Date(archived.createdAt)
  );
  hook.unmount();
});
