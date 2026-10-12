/**
 * @jest-environment jsdom
 */

/**
 * The gym editor's unit handling. The gym's `weight_unit` is a display OVERRIDE that outranks the
 * account setting, so it may only ever hold what the user explicitly picked: the first version
 * copied the account's unit onto every saved gym, which then kept showing the old unit after the
 * account was switched. The form also holds its weights in kilograms, so flipping the unit mockPicker
 * re-expresses a value instead of drifting it (20 kg → 44.09 lb → 19.999 kg).
 */

import { act, render } from '@testing-library/react';
import { createElement } from 'react';

import { EditGymModal } from '@/components/modals/EditGymModal';
import { GymService } from '@/database/services/GymService';

const mockSteppers = new Map<string, any>();
let mockPicker: any = null;
const mockButtons = new Map<string, any>();
let mockAccountUnits: 'metric' | 'imperial' = 'metric';

jest.mock('lucide-react-native', () => ({ Plus: () => null, X: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => (options?.unit ? `${key}|${options.unit}` : key),
  }),
}));
jest.mock('@/components/theme/StepperInput', () => ({
  StepperInput: (props: any) => {
    mockSteppers.set(props.label.split('|')[0], props);
    return null;
  },
}));
jest.mock('@/components/theme/TextInput', () => ({ TextInput: () => null }));
jest.mock('@/components/theme/Button', () => ({
  Button: (props: any) => {
    mockButtons.set(props.label, props);
    return null;
  },
}));
jest.mock('@/components/workout/WeightUnitOverridePicker', () => ({
  WeightUnitOverridePicker: (props: any) => {
    mockPicker = props;
    return null;
  },
}));
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({ children, footer }: any) =>
    require('react').createElement('div', null, children, footer),
}));
jest.mock('@/components/modals/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: jest.fn() }),
}));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ units: mockAccountUnits }) }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ locale: 'en-US' }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () =>
    new Proxy(
      {},
      { get: () => new Proxy({}, { get: () => new Proxy({}, { get: () => '#000' }) }) }
    ),
}));
jest.mock('@/database/services/GymService', () => ({
  GymService: { createGym: jest.fn().mockResolvedValue({}), updateGym: jest.fn() },
}));

const createGym = GymService.createGym as jest.Mock;
const updateGym = GymService.updateGym as jest.Mock;

function openEditor(gym: any = null) {
  render(createElement(EditGymModal, { visible: true, onClose: jest.fn(), gym }));
}

async function save() {
  await act(async () => {
    await mockButtons.get('workoutSettings.editGym.save').onPress();
  });
}

const bar = () => mockSteppers.get('workoutSettings.editGym.bar');

// React Native host props (`accessible`, `collapsable`, …) mean nothing to react-dom, which warns
// about each one. Only that noise is muted; any other console error still surfaces.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((message: unknown, ...rest: unknown[]) => {
    const text = String(message);
    if (
      text.includes('for a non-boolean attribute') ||
      text.includes('React does not recognize the') ||
      text.includes('is using incorrect casing') ||
      text.includes('is unrecognized in this browser') ||
      text.includes('Unknown event handler property')
    ) {
      return;
    }
    consoleError(message, ...rest);
  });
});
afterAll(() => jest.restoreAllMocks());

describe('EditGymModal units', () => {
  beforeEach(() => {
    mockSteppers.clear();
    mockButtons.clear();
    mockPicker = null;
    mockAccountUnits = 'metric';
    jest.clearAllMocks();
  });

  it('saves NO unit when the user did not pick one, whatever the account uses', async () => {
    mockAccountUnits = 'imperial';
    openEditor();

    await save();

    expect(createGym.mock.calls[0][0].weightUnit).toBeNull();
  });

  it('saves the unit the user explicitly picked', async () => {
    openEditor();

    act(() => mockPicker.onChange('lbs'));
    await save();

    expect(createGym.mock.calls[0][0].weightUnit).toBe('lbs');
  });

  it('re-expresses the form in the picked unit without changing the stored kilograms', async () => {
    openEditor();
    expect(bar().value).toBe(20);
    expect(bar().unit).toBe('workoutSession.kg');

    act(() => mockPicker.onChange('lbs'));
    expect(bar().value).toBeCloseTo(44.09, 2);
    expect(bar().unit).toBe('workoutSession.lb');

    act(() => mockPicker.onChange(null));
    await save();

    expect(createGym.mock.calls[0][0].barWeightKg).toBe(20);
  });

  it('keeps an existing pin, and lets it be cleared back to the account setting', async () => {
    openEditor({
      id: 'g1',
      name: 'Garage',
      barWeightKg: 20.4117,
      plates: [],
      weightIncrementKg: 2.2679,
      equipment: [],
      weightUnit: 'lbs',
    });
    expect(mockPicker.value).toBe('lbs');
    expect(bar().value).toBe(45);

    act(() => mockPicker.onChange(null));
    await save();

    expect(updateGym).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ weightUnit: null, barWeightKg: 20.4117 })
    );
  });

  it('nudges in the unit shown and stores kilograms', async () => {
    mockAccountUnits = 'imperial';
    openEditor();
    expect(bar().value).toBe(45);
    expect(bar().step).toBe(5);

    act(() => bar().onIncrement());
    expect(bar().value).toBe(50);
    await save();

    expect(createGym.mock.calls[0][0].barWeightKg).toBeCloseTo(22.68, 2);
  });
});
