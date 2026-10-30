/**
 * @jest-environment jsdom
 */

/**
 * The host every diary surface (a food, a meal section, a grouped meal, a long-press selection)
 * files its actions with. The sheets are stubbed down to their props, so these pin what the host
 * itself owns: which write runs, what is reported, and what happens when it fails.
 */

import { act, render } from '@testing-library/react';
import { createElement } from 'react';

import { DiaryActionPanels } from '@/components/nutrition/DiaryActionPanels';
import type { DiaryActionRequest, DiaryPanelKind } from '@/components/nutrition/diaryActions';
import type { DiarySelection } from '@/components/nutrition/foodDiarySelection';
import { KEEP_MEAL_TYPES } from '@/database/models/mealTypeTarget';
import { NutritionService } from '@/database/services/NutritionService';
import { handleError } from '@/utils/handleError';

type SheetProps = Record<string, any>;
let mockSheet: SheetProps = {};

const mockShowSnackbar = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-group' }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn(async () => undefined) }));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    transferNutritionLogs: jest.fn(),
    splitNutritionLogsToDate: jest.fn(),
    groupNutritionLogs: jest.fn(),
    deleteNutritionLogsBatch: jest.fn(),
  },
  scaleMealNutritionLogsToTotalGrams: jest.fn(),
}));

function mockStub(props: SheetProps) {
  mockSheet = props;
  return null;
}
jest.mock('@/components/modals/MoveCopyMealModal', () => ({ MoveCopyMealModal: mockStub }));
jest.mock('@/components/modals/ScaleMealPortionModal', () => ({ ScaleMealPortionModal: mockStub }));
jest.mock('@/components/modals/CombineIntoMealModal', () => ({ CombineIntoMealModal: mockStub }));
jest.mock('@/components/modals/ConfirmationModal', () => ({ ConfirmationModal: mockStub }));

const logs = [{ id: 'a' }, { id: 'b' }];
const selection = {
  entries: logs.map((log) => ({ log, gramWeight: 100 })),
  groups: [],
  itemCount: 2,
  mealTypes: ['breakfast', 'dinner'],
  commonMealType: null,
  totalGrams: 200,
  totalNutrients: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
} as unknown as DiarySelection;

const selectedDate = new Date(2026, 7, 1);
const service = NutritionService as unknown as Record<string, jest.Mock>;

function mount(panel: DiaryPanelKind, over: Partial<DiaryActionRequest> = {}) {
  const callbacks = {
    onClose: jest.fn(),
    onDone: jest.fn(),
    refresh: jest.fn().mockResolvedValue(undefined),
  };
  const request: DiaryActionRequest = {
    scope: 'selection',
    panel,
    selection,
    subjectName: '',
    ...over,
  };
  render(createElement(DiaryActionPanels, { request, selectedDate, ...callbacks }));

  return callbacks;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSheet = {};
  Object.values(service).forEach((fn) => fn.mockResolvedValue(undefined));
});

describe('DiaryActionPanels', () => {
  it('mounts nothing without a request', () => {
    const { container } = render(
      createElement(DiaryActionPanels, {
        request: null,
        selectedDate,
        onClose: jest.fn(),
        onDone: jest.fn(),
        refresh: jest.fn(),
      })
    );

    expect(container.innerHTML).toBe('');
    expect(mockSheet).toEqual({});
  });

  it('copies through the one transfer method and words the success for the scope', async () => {
    const { onDone, refresh } = mount('copy');

    expect(mockSheet.allowKeepMealTypes).toBe(true);
    await act(() => mockSheet.onConfirm(selectedDate, KEEP_MEAL_TYPES));

    expect(service.transferNutritionLogs).toHaveBeenCalledWith(
      logs,
      'copy',
      selectedDate,
      KEEP_MEAL_TYPES
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'success',
      'food.selection.copySuccess|{"count":2}'
    );
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('splits a concrete meal, and refuses to split into "keep"', async () => {
    mount('split', { scope: 'meal' });

    await act(() => mockSheet.onConfirm(selectedDate, 'lunch', 25));
    expect(service.splitNutritionLogsToDate).toHaveBeenCalledWith(logs, selectedDate, 'lunch', 25);

    await expect(mockSheet.onConfirm(selectedDate, KEEP_MEAL_TYPES, 25)).rejects.toThrow(
      'concrete meal'
    );
    expect(service.splitNutritionLogsToDate).toHaveBeenCalledTimes(1);
  });

  it('reports a failed transfer once and rethrows, so the sheet stays open with its input', async () => {
    const { onDone } = mount('move');
    service.transferNutritionLogs.mockRejectedValue(new Error('disk full'));

    await expect(mockSheet.onConfirm(selectedDate, 'lunch')).rejects.toThrow('disk full');

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'food.diary.move', {
      snackbarMessage: 'food.actions.moveError',
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('does not call a write that went through failed because the reload after it did', async () => {
    const { onDone, refresh } = mount('copy');
    refresh.mockRejectedValue(new Error('reload'));

    await act(() => mockSheet.onConfirm(selectedDate, 'lunch'));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'food.diary.refresh', {
      snackbarMessage: 'food.errors.refreshFailed',
    });
  });

  it('runs a delete once however fast the confirm is pressed', async () => {
    let finish: () => void = () => undefined;
    service.deleteNutritionLogsBatch.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { onDone } = mount('delete');

    let presses: Promise<void>[] = [];
    await act(async () => {
      presses = [mockSheet.onConfirm(), mockSheet.onConfirm()];
    });
    await act(async () => {
      finish();
      await Promise.all(presses);
    });

    expect(service.deleteNutritionLogsBatch).toHaveBeenCalledTimes(1);
    expect(service.deleteNutritionLogsBatch).toHaveBeenCalledWith(logs);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('words a delete for its scope, and closes after reporting a failure instead of rethrowing', async () => {
    const { onDone } = mount('delete', { scope: 'food', subjectName: 'Oats' });

    expect(mockSheet.title).toBe('food.actions.deleteConfirmTitle|{"foodName":"Oats"}');

    service.deleteNutritionLogsBatch.mockRejectedValue(new Error('locked'));
    await act(() => mockSheet.onConfirm());

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'food.diary.delete', {
      snackbarMessage: 'food.actions.deleteError',
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('refuses to scale a set with no gram weight, and closes', async () => {
    const { onClose } = mount('scale', {
      selection: { ...selection, totalGrams: 0 } as DiarySelection,
    });

    await act(() => mockSheet.onConfirm(150));

    expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.actions.scaleMealPortionError');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('combines under a fresh group id', async () => {
    mount('combine');

    await act(() => mockSheet.onConfirm('Bowl', 'lunch'));

    expect(service.groupNutritionLogs).toHaveBeenCalledWith(logs, {
      groupId: 'new-group',
      mealName: 'Bowl',
      mealType: 'lunch',
    });
  });
});
