import {
    FEET,
    KILOGRAMS,
    METERS,
    METRIC_SYSTEM,
    POUNDS,
} from '@/constants/storage';
import { getSetting } from '@/utils/database';

import {
    getDisplayFormattedHeight,
    getDisplayFormattedWeight,
    getSaveFormattedHeight,
    getSaveFormattedWeight,
    getUnit,
} from './unit';

jest.mock('@/utils/database', () => ({
    getSetting: jest.fn(),
}));

describe('Unit Utils Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getUnit with metric system', async () => {
        (getSetting as jest.Mock).mockResolvedValue({ value: METRIC_SYSTEM });

        const unit = await getUnit();
        expect(unit).toEqual({
            heightUnit: METERS,
            unitSystem: METRIC_SYSTEM,
            weightUnit: KILOGRAMS,
        });
    });

    test('getUnit with imperial system', async () => {
        (getSetting as jest.Mock).mockResolvedValue({ value: 'imperial' });

        const unit = await getUnit();
        expect(unit).toEqual({
            heightUnit: FEET,
            unitSystem: 'imperial',
            weightUnit: POUNDS,
        });
    });

    test('getDisplayFormattedWeight to imperial', () => {
        expect(getDisplayFormattedWeight(100, KILOGRAMS, true)).toBeCloseTo(220.46);
    });

    test('getDisplayFormattedWeight to metric', () => {
        expect(getDisplayFormattedWeight(100, KILOGRAMS, false)).toBe(100);
    });

    test('getDisplayFormattedHeight to imperial', () => {
        expect(getDisplayFormattedHeight(1.75, true)).toBeCloseTo(5.74);
    });

    test('getDisplayFormattedHeight to metric', () => {
        expect(getDisplayFormattedHeight(1.75, false)).toBe(1.75);
    });

    test('getSaveFormattedWeight to imperial', () => {
        expect(getSaveFormattedWeight(220.46, POUNDS, true)).toBeCloseTo(100);
    });

    test('getSaveFormattedWeight to metric', () => {
        expect(getSaveFormattedWeight(100, KILOGRAMS, false)).toBe(100);
    });

    test('getSaveFormattedHeight to imperial', () => {
        expect(getSaveFormattedHeight(5.74, true)).toBeCloseTo(1.75);
    });

    test('getSaveFormattedHeight to metric', () => {
        expect(getSaveFormattedHeight(1.75, false)).toBe(1.75);
    });
});
