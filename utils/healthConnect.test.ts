import {
    HealthConnectBodyFatRecordData,
    HealthConnectHeightRecord,
    HealthConnectWeightRecord,
} from '@/utils/types';

import { aggregateUserNutritionMetricsDataByDate } from './healthConnect';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('@/storage/HealthConnectProvider', () => ({
    checkIsHealthConnectedPermitted: jest.fn(),
    getHealthConnectData: jest.fn(),
}));

jest.mock('@/lang/lang', () => ({
    language: 'en-US',
    LOCALE_MAP: {
        'en-US': require('date-fns/locale/en-US'),
    },
}));

jest.mock('@/utils/database', () => ({
    getSetting: jest.fn(),
}));

describe('Health Connect Utils Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('aggregateUserNutritionMetricsDataByDate', () => {
        const latestHeight: HealthConnectHeightRecord = {
            height: { inMeters: 1.75 },
            metadata: { id: 'height1' },
            time: '2023-07-12T12:00:00Z',
        } as HealthConnectHeightRecord;

        const latestWeight: HealthConnectWeightRecord = {
            metadata: { id: 'weight1' },
            time: '2023-07-12T12:00:00Z',
            weight: { inKilograms: 70 },
        } as HealthConnectWeightRecord;

        const latestBodyFat: HealthConnectBodyFatRecordData = {
            metadata: { id: 'fat1' },
            percentage: 20,
            time: '2023-07-12T12:00:00Z',
        } as HealthConnectBodyFatRecordData;

        const result = aggregateUserNutritionMetricsDataByDate(latestHeight, latestWeight, latestBodyFat);
        expect(result).toEqual({
            '2023-07-12': {
                bodyFatData: latestBodyFat,
                heightData: latestHeight,
                weightData: latestWeight,
            },
        });
    });
});
