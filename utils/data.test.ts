import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { NUTRITION_TYPES } from '@/constants/nutrition';
import {
    aggregateDataByWeek,
    aggregateNutritionData,
    aggregateUserMetricsNutrition,
    calculateTDEE,
    calculateUserMetricsNutritionWeeklyAverages,
    isEmptyObject,
    isTrendingUpwards,
} from '@/utils/data';
import {
    AggregatedUserMetricsNutritionType,
    UserMetricsDecryptedReturnType,
    UserNutritionDecryptedReturnType,
} from '@/utils/types';

jest.mock('@/utils/date', () => ({
    formatDate: jest.fn((date, format) => date),
}));

jest.mock('@/utils/string', () => ({
    generateHash: jest.fn(() => '123'),
}));

jest.mock('@/lang/lang', () => ({
    language: 'en-US',
    LOCALE_MAP: {
        'en-US': require('date-fns/locale/en-US'),
    },
}));

describe('Nutrition and Metrics Functions', () => {
    test('calculate TDEE with fat percentage', () => {
        const result = calculateTDEE(20000, 10, 70, 72, 20, 21);
        expect(result).toBeCloseTo(666.72, 2);
    });

    test('calculate TDEE without fat percentage', () => {
        const result = calculateTDEE(20000, 10, 70, 72);
        expect(result).toBeCloseTo(726, 2);
    });

    test('aggregateNutritionData with full day data', () => {
        const data: UserNutritionDecryptedReturnType[] = [{
            calories: 500,
            carbohydrate: 50,
            createdAt: '2023-07-01',
            fat: 20,
            fiber: 0,
            name: 'Breakfast',
            protein: 30,
            type: NUTRITION_TYPES.FULL_DAY,
        } as UserNutritionDecryptedReturnType];

        const result = aggregateNutritionData(data);
        expect(result).toEqual({
            '2023-07-01': {
                calories: 500,
                carbohydrate: 50,
                date: '2023-07-01',
                fat: 20,
                fiber: 0,
                foods: ['Breakfast'],
                protein: 30,
            },
        });
    });

    test('aggregateNutritionData with non-full day data', () => {
        const data: UserNutritionDecryptedReturnType[] = [{
            calories: 200,
            carbohydrate: 30,
            createdAt: '2023-07-01',
            fat: 10,
            fiber: 0,
            name: 'Breakfast',
            protein: 20,
            type: NUTRITION_TYPES.MEAL,
        },
        {
            calories: 600,
            carbohydrate: 80,
            createdAt: '2023-07-01',
            fat: 30,
            fiber: 0,
            name: 'Lunch',
            protein: 40,
            type: NUTRITION_TYPES.MEAL,
        }] as UserNutritionDecryptedReturnType[];

        const result = aggregateNutritionData(data);
        expect(result).toEqual({
            '2023-07-01': {
                calories: 800,
                carbohydrate: 110,
                date: '2023-07-01',
                fat: 40,
                fiber: 0,
                foods: ['Breakfast', 'Lunch'],
                protein: 60,
            },
        });
    });

    test('isEmptyObject returns true for empty object', () => {
        expect(isEmptyObject({})).toBe(true);
    });

    test('isEmptyObject returns false for non-empty object', () => {
        expect(isEmptyObject({ key: 'value' })).toBe(false);
    });

    test('isTrendingUpwards with increasing data', () => {
        const data = [
            { x: 1, y: 2 },
            { x: 2, y: 3 },
            { x: 3, y: 5 },
        ];
        expect(isTrendingUpwards(data)).toBe(true);
    });

    test('isTrendingUpwards with non-increasing data', () => {
        const data = [
            { x: 1, y: 5 },
            { x: 2, y: 3 },
            { x: 3, y: 1 },
        ];
        expect(isTrendingUpwards(data)).toBe(false);
    });

    test('aggregateUserMetricsNutrition', () => {
        const nutritionData: UserNutritionDecryptedReturnType[] = [{
            calories: 2000,
            carbohydrate: 250,
            createdAt: '2023-07-01',
            dataId: '123',
            date: '2023-07-01',
            fat: 70,
            name: 'Breakfast',
            protein: 100,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            type: NUTRITION_TYPES.MEAL,
        } as UserNutritionDecryptedReturnType];

        const metricsData: UserMetricsDecryptedReturnType[] = [{
            dataId: '123',
            date: '2023-07-01',
            fatPercentage: 20,
            weight: 70,
        } as UserMetricsDecryptedReturnType];

        const result = aggregateUserMetricsNutrition(nutritionData, metricsData);
        expect(result).toEqual({
            '2023-07-01': {
                dataId: '123',
                date: '2023-07-01',
                fatPercentage: 20,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2000,
                totalCarbs: 250,
                totalFats: 70,
                totalProteins: 100,
                weight: 70,
            },
        });
    });

    test('aggregateUserMetricsNutrition with skipCurrentDay', () => {
        const nutritionData: UserNutritionDecryptedReturnType[] = [{
            calories: 2000,
            carbohydrate: 250,
            createdAt: (new Date()).toISOString(),
            dataId: '123',
            date: (new Date()).toISOString(),
            fat: 70,
            id: 1,
            name: 'Breakfast',
            protein: 100,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            type: NUTRITION_TYPES.MEAL,
        }, {
            calories: 2000,
            carbohydrate: 250,
            createdAt: '2024-09-10',
            dataId: '123',
            date: '2024-09-10',
            fat: 70,
            id: 2,
            name: 'Breakfast',
            protein: 100,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            type: NUTRITION_TYPES.MEAL,
        }];

        const metricsData: UserMetricsDecryptedReturnType[] = [{
            dataId: '123',
            date: (new Date()).toISOString(),
            fatPercentage: 20,
            id: 1,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            weight: 70,
        }, {
            dataId: '123',
            date: '2023-09-10',
            fatPercentage: 20,
            id: 2,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            weight: 70,
        }];

        // Skip current day data
        const result = aggregateUserMetricsNutrition(nutritionData, metricsData, true);
        expect(result).toEqual({
            '2023-09-10': {
                dataId: '123',
                date: '2023-09-10',
                fatPercentage: 20,
                id: 2,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 0,
                totalCarbs: 0,
                totalFats: 0,
                totalProteins: 0,
                weight: 70,
            },
            '2024-09-10': {
                dataId: '123',
                date: '2024-09-10',
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2000,
                totalCarbs: 250,
                totalFats: 70,
                totalProteins: 100,
            },
        });
    });

    test('aggregateUserMetricsNutrition without skipCurrentDay', () => {
        const today = (new Date()).toISOString();
        const nutritionData: UserNutritionDecryptedReturnType[] = [{
            calories: 2000,
            carbohydrate: 250,
            createdAt: today,
            dataId: '123',
            date: today,
            fat: 70,
            name: 'Breakfast',
            protein: 100,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            type: NUTRITION_TYPES.MEAL,
        } as UserNutritionDecryptedReturnType];

        const metricsData: UserMetricsDecryptedReturnType[] = [{
            dataId: '123',
            date: today,
            fatPercentage: 20,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            weight: 70,
        } as UserMetricsDecryptedReturnType];

        // Do not skip current day data
        const result = aggregateUserMetricsNutrition(nutritionData, metricsData, false);
        expect(result).toEqual({
            [today]: {
                dataId: '123',
                date: today,
                fatPercentage: 20,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2000,
                totalCarbs: 250,
                totalFats: 70,
                totalProteins: 100,
                weight: 70,
            },
        });
    });

    test('calculateUserMetricsNutritionWeeklyAverages', () => {
        const aggregatedUserMetricsNutrition: AggregatedUserMetricsNutritionType = {
            '2023-07-01': {
                dataId: '123',
                date: '2023-07-01',
                fatPercentage: 20,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2000,
                totalCarbs: 250,
                totalFats: 25,
                totalProteins: 100,
                weight: 70,
            },
            '2023-07-02': {
                dataId: '123',
                date: '2023-07-02',
                fatPercentage: 21,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2100,
                totalCarbs: 260,
                totalFats: 25,
                totalProteins: 110,
                weight: 71,
            },
            '2023-07-03': {
                dataId: '123',
                date: '2023-07-03',
                fatPercentage: 22,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2200,
                totalCarbs: 270,
                totalFats: 25,
                totalProteins: 120,
                weight: 72,
            },
            '2023-07-04': {
                dataId: '123',
                date: '2023-07-04',
                fatPercentage: 23,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2300,
                totalCarbs: 280,
                totalFats: 25,
                totalProteins: 130,
                weight: 73,
            },
            '2023-07-05': {
                dataId: '123',
                date: '2023-07-05',
                fatPercentage: 24,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2400,
                totalCarbs: 290,
                totalFats: 25,
                totalProteins: 140,
                weight: 74,
            },
            '2023-07-06': {
                dataId: '123',
                date: '2023-07-06',
                fatPercentage: 25,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2500,
                totalCarbs: 300,
                totalFats: 25,
                totalProteins: 150,
                weight: 75,
            },
            '2023-07-07': {
                dataId: '123',
                date: '2023-07-07',
                fatPercentage: 26,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                totalCalories: 2600,
                totalCarbs: 310,
                totalFats: 25,
                totalProteins: 160,
                weight: 76,
            },
        };

        const result = calculateUserMetricsNutritionWeeklyAverages(aggregatedUserMetricsNutrition);
        expect(result).toEqual({
            totalDays: 7,
            weeklyAverages: [
                {
                    averageCalories: 2000,
                    averageCarbs: 250,
                    averageFatPercentage: 20,
                    averageFats: 25,
                    averageProteins: 100,
                    averageWeight: 70,
                    weekEndDate: '2023-07-01',
                    weekStartDate: '2023-07-01',
                },
                {
                    averageCalories: 2100,
                    averageCarbs: 260,
                    averageFatPercentage: 21,
                    averageFats: 25,
                    averageProteins: 110,
                    averageWeight: 71,
                    weekEndDate: '2023-07-02',
                    weekStartDate: '2023-07-02',
                },
                {
                    averageCalories: 2200,
                    averageCarbs: 270,
                    averageFatPercentage: 22,
                    averageFats: 25,
                    averageProteins: 120,
                    averageWeight: 72,
                    weekEndDate: '2023-07-03',
                    weekStartDate: '2023-07-03',
                },
                {
                    averageCalories: 2300,
                    averageCarbs: 280,
                    averageFatPercentage: 23,
                    averageFats: 25,
                    averageProteins: 130,
                    averageWeight: 73,
                    weekEndDate: '2023-07-04',
                    weekStartDate: '2023-07-04',
                },
                {
                    averageCalories: 2400,
                    averageCarbs: 290,
                    averageFatPercentage: 24,
                    averageFats: 25,
                    averageProteins: 140,
                    averageWeight: 74,
                    weekEndDate: '2023-07-05',
                    weekStartDate: '2023-07-05',
                },
                {
                    averageCalories: 2500,
                    averageCarbs: 300,
                    averageFatPercentage: 25,
                    averageFats: 25,
                    averageProteins: 150,
                    averageWeight: 75,
                    weekEndDate: '2023-07-06',
                    weekStartDate: '2023-07-06',
                },
                {
                    averageCalories: 2600,
                    averageCarbs: 310,
                    averageFatPercentage: 26,
                    averageFats: 25,
                    averageProteins: 160,
                    averageWeight: 76,
                    weekEndDate: '2023-07-07',
                    weekStartDate: '2023-07-07',
                },
            ],
        });
    });

    it('should correctly aggregate data by week', () => {
        const userMetrics: UserMetricsDecryptedReturnType[] = [
            {
                dataId: '123',
                date: '2024-05-26T09:12:00Z',
                height: 175,
                id: 1,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 70,
            },
            {
                dataId: '124',
                date: '2024-05-27T09:12:00Z',
                height: 175,
                id: 2,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 71,
            },
            {
                dataId: '125',
                date: '2024-06-02T09:12:00Z',
                height: 175,
                id: 3,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 72,
            },
        ];

        const aggregatedData = aggregateDataByWeek(userMetrics);

        expect(aggregatedData.length).toBe(2);

        expect(aggregatedData[0].weekStart).toBe('2024-05-20T00:00:00+02:00');
        expect(aggregatedData[0].weekEnd).toBe('2024-05-26T23:59:59+02:00');
        expect(aggregatedData[0].data.length).toBe(1);

        expect(aggregatedData[1].weekStart).toBe('2024-05-27T00:00:00+02:00');
        expect(aggregatedData[1].weekEnd).toBe('2024-06-02T23:59:59+02:00');
        expect(aggregatedData[1].data.length).toBe(2);
    });

    it('should handle empty data input', () => {
        const userMetrics: UserMetricsDecryptedReturnType[] = [];
        const aggregatedData = aggregateDataByWeek(userMetrics);

        expect(aggregatedData.length).toBe(0);
    });

    it('should correctly aggregate data when all entries are in the same week', () => {
        const userMetrics: UserMetricsDecryptedReturnType[] = [
            {
                dataId: '123',
                date: '2024-05-26T09:12:00Z',
                height: 175,
                id: 1,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 70,
            },
            {
                dataId: '124',
                date: '2024-05-28T09:12:00Z',
                height: 175,
                id: 2,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 71,
            },
            {
                dataId: '125',
                date: '2024-05-30T09:12:00Z',
                height: 175,
                id: 3,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 72,
            },
        ];

        const aggregatedData = aggregateDataByWeek(userMetrics);

        expect(aggregatedData.length).toBe(2);
        expect(aggregatedData[0].data.length).toBe(1);
    });

    it('should correctly aggregate data with multiple entries in different weeks', () => {
        const userMetrics: UserMetricsDecryptedReturnType[] = [
            {
                dataId: '123',
                date: '2024-05-26T09:12:00Z',
                height: 175,
                id: 1,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 70,
            },
            {
                dataId: '124',
                date: '2024-06-03T09:12:00Z',
                height: 175,
                id: 2,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 71,
            },
            {
                dataId: '125',
                date: '2024-06-09T09:12:00Z',
                height: 175,
                id: 3,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 72,
            },
        ];

        const aggregatedData = aggregateDataByWeek(userMetrics);

        expect(aggregatedData.length).toBe(2);

        expect(aggregatedData[0].data.length).toBe(1);
        expect(aggregatedData[1].data.length).toBe(2);
    });

    it('should correctly aggregate data with 15+ entries spanning multiple weeks', () => {
        const userMetrics: UserMetricsDecryptedReturnType[] = [
            {
                dataId: '101',
                date: '2024-05-20T08:00:00Z',
                height: 175,
                id: 1,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 70,
            },
            {
                dataId: '102',
                date: '2024-05-21T09:00:00Z',
                height: 175,
                id: 2,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 71,
            },
            {
                dataId: '103',
                date: '2024-05-22T10:00:00Z',
                height: 175,
                id: 3,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 72,
            },
            {
                dataId: '104',
                date: '2024-05-23T11:00:00Z',
                height: 175,
                id: 4,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 73,
            },
            {
                dataId: '105',
                date: '2024-05-24T12:00:00Z',
                height: 175,
                id: 5,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 74,
            },
            {
                dataId: '106',
                date: '2024-05-25T13:00:00Z',
                height: 175,
                id: 6,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 75,
            },
            {
                dataId: '107',
                date: '2024-05-26T14:00:00Z',
                height: 175,
                id: 7,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 76,
            },
            {
                dataId: '108',
                date: '2024-05-27T15:00:00Z',
                height: 175,
                id: 8,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 77,
            },
            {
                dataId: '109',
                date: '2024-05-28T16:00:00Z',
                height: 175,
                id: 9,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 78,
            },
            {
                dataId: '110',
                date: '2024-05-29T17:00:00Z',
                height: 175,
                id: 10,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 79,
            },
            {
                dataId: '111',
                date: '2024-05-30T18:00:00Z',
                height: 175,
                id: 11,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 80,
            },
            {
                dataId: '112',
                date: '2024-05-31T19:00:00Z',
                height: 175,
                id: 12,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 81,
            },
            {
                dataId: '113',
                date: '2024-06-01T20:00:00Z',
                height: 175,
                id: 13,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 82,
            },
            {
                dataId: '114',
                date: '2024-06-02T21:00:00Z',
                height: 175,
                id: 14,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 83,
            },
            {
                dataId: '115',
                date: '2024-06-03T22:00:00Z',
                height: 175,
                id: 15,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 84,
            },
            {
                dataId: '116',
                date: '2024-06-04T23:00:00Z',
                height: 175,
                id: 16,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 85,
            },
            {
                dataId: '117',
                date: '2024-06-05T24:00:00Z',
                height: 175,
                id: 17,
                source: USER_METRICS_SOURCES.USER_INPUT,
                weight: 86,
            },
        ];

        const aggregatedData = aggregateDataByWeek(userMetrics);

        expect(aggregatedData.length).toBe(3);

        expect(aggregatedData).toEqual([{
            data: [{
                dataId: '101',
                date: '2024-05-20T08:00:00Z',
                height: 175,
                id: 1,
                source: 'user_input',
                weight: 70,
            }, {
                dataId: '102',
                date: '2024-05-21T09:00:00Z',
                height: 175,
                id: 2,
                source: 'user_input',
                weight: 71,
            }, {
                dataId: '103',
                date: '2024-05-22T10:00:00Z',
                height: 175,
                id: 3,
                source: 'user_input',
                weight: 72,
            }, {
                dataId: '104',
                date: '2024-05-23T11:00:00Z',
                height: 175,
                id: 4,
                source: 'user_input',
                weight: 73,
            }, {
                dataId: '105',
                date: '2024-05-24T12:00:00Z',
                height: 175,
                id: 5,
                source: 'user_input',
                weight: 74,
            }, {
                dataId: '106',
                date: '2024-05-25T13:00:00Z',
                height: 175,
                id: 6,
                source: 'user_input',
                weight: 75,
            }, {
                dataId: '107',
                date: '2024-05-26T14:00:00Z',
                height: 175,
                id: 7,
                source: 'user_input',
                weight: 76,
            }],
            weekEnd: '2024-05-26T23:59:59+02:00',
            weekStart: '2024-05-20T00:00:00+02:00',
        }, {
            data: [{
                dataId: '108',
                date: '2024-05-27T15:00:00Z',
                height: 175,
                id: 8,
                source: 'user_input',
                weight: 77,
            }, {
                dataId: '109',
                date: '2024-05-28T16:00:00Z',
                height: 175,
                id: 9,
                source: 'user_input',
                weight: 78,
            }, {
                dataId: '110',
                date: '2024-05-29T17:00:00Z',
                height: 175,
                id: 10,
                source: 'user_input',
                weight: 79,
            }, {
                dataId: '111',
                date: '2024-05-30T18:00:00Z',
                height: 175,
                id: 11,
                source: 'user_input',
                weight: 80,
            }, {
                dataId: '112',
                date: '2024-05-31T19:00:00Z',
                height: 175,
                id: 12,
                source: 'user_input',
                weight: 81,
            }, {
                dataId: '113',
                date: '2024-06-01T20:00:00Z',
                height: 175,
                id: 13,
                source: 'user_input',
                weight: 82,
            }, {
                dataId: '114',
                date: '2024-06-02T21:00:00Z',
                height: 175,
                id: 14,
                source: 'user_input',
                weight: 83,
            }],
            weekEnd: '2024-06-02T23:59:59+02:00',
            weekStart: '2024-05-27T00:00:00+02:00',
        }, {
            data: [{
                dataId: '115',
                date: '2024-06-03T22:00:00Z',
                height: 175,
                id: 15,
                source: 'user_input',
                weight: 84,
            }, {
                dataId: '116',
                date: '2024-06-04T23:00:00Z',
                height: 175,
                id: 16,
                source: 'user_input',
                weight: 85,
            }, {
                dataId: '117',
                date: '2024-06-05T24:00:00Z',
                height: 175,
                id: 17,
                source: 'user_input',
                weight: 86,
            }],
            weekEnd: '2024-06-09T23:59:59+02:00',
            weekStart: '2024-06-03T00:00:00+02:00',
        }]);
    });
});
