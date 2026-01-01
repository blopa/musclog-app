import { FRIDAY, MONDAY, WEDNESDAY } from '@/constants/storage';

import {
    formatTime,
    getCurrentDayOfWeek,
    getCurrentTimestampISOString,
    getDayOfWeek,
    getNextDayOfWeekDate,
    isValidDate,
    isValidDateParam,
} from './date';

jest.mock('@/lang/lang', () => ({
    language: 'en-US',
    LOCALE_MAP: {
        'en-US': require('date-fns/locale/en-US'),
    },
}));

describe('Date Utils Functions', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-07-12T12:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('getNextDayOfWeekDate', () => {
        expect(getNextDayOfWeekDate(FRIDAY)).toEqual(new Date('2023-07-14T12:00:00Z'));
        expect(getNextDayOfWeekDate(MONDAY)).toEqual(new Date('2023-07-17T12:00:00Z'));
    });

    test('getCurrentDayOfWeek', () => {
        expect(getCurrentDayOfWeek()).toBe(WEDNESDAY);
    });

    test('getDayOfWeek', () => {
        expect(getDayOfWeek(new Date('2023-07-12T12:00:00Z'))).toBe(WEDNESDAY);
        expect(getDayOfWeek(new Date('2023-07-14T12:00:00Z'))).toBe(FRIDAY);
    });

    test('formatDate', () => {
        // TODO
    });

    test('isValidDate', () => {
        expect(isValidDate(new Date('2023-07-12T12:00:00Z'))).toBe(true);
        expect(isValidDate(new Date('invalid date'))).toBe(false);
    });

    test('isValidDateParam', () => {
        expect(isValidDateParam(new Date('2023-07-12T12:00:00Z'))).toBe(true);
        expect(isValidDateParam('2023-07-12T12:00:00Z')).toBe(true);
        expect(isValidDateParam('invalid date')).toBe(false);
    });

    test('formatTime', () => {
        expect(formatTime(3661000)).toBe('01:01:01:00');
        expect(formatTime(3661000, false)).toBe('01:01:01');
        expect(formatTime(61000)).toBe('01:01:00');
        expect(formatTime(61000, false)).toBe('01:01');
    });

    test('getCurrentTimestamp', () => {
        expect(getCurrentTimestampISOString()).toBe('2023-07-12T12:00:00.000Z');
    });
});
