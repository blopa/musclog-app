import type { Locale } from 'date-fns';

import {
    FRIDAY,
    MONDAY,
    SATURDAY,
    SUNDAY,
    THURSDAY,
    TUESDAY,
    WEDNESDAY,
} from '@/constants/storage';
import i18n, { LOCALE_MAP } from '@/lang/lang';
import { format, parseISO } from 'date-fns';

const daysOfWeekMap: { [key: string]: number } = {
    [FRIDAY]: 5,
    [MONDAY]: 1,
    [SATURDAY]: 6,
    [SUNDAY]: 0,
    [THURSDAY]: 4,
    [TUESDAY]: 2,
    [WEDNESDAY]: 3,
};

export const getNextDayOfWeekDate = (dayOfWeek: string): Date => {
    const now = new Date();
    const resultDate = new Date(now);
    resultDate.setDate(now.getDate() + ((daysOfWeekMap[dayOfWeek] + 7 - now.getDay()) % 7));

    return resultDate;
};

export const getCurrentDayOfWeek = (): string => {
    return getDayOfWeek(new Date());
};

export const getDayOfWeek = (date: Date): string => {
    const dayOfWeek = date.getDay();

    return Object.keys(daysOfWeekMap).find((key) => daysOfWeekMap[key] === dayOfWeek)!;
};

export const formatDate = (date: string, formatStr = 'EEEE, MMMM do, yyyy'): string => {
    const language = i18n.language as keyof typeof LOCALE_MAP;
    return format(parseISO(date), formatStr, {
        locale: LOCALE_MAP[language] as Locale,
    });
};

export const isValidDate = (date: any): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
};

export const isValidDateParam = (date: any): date is Date | string => {
    return !isNaN(new Date(date).getTime());
};

export const formatTime = (timeInMs: number, useMilliseconds: boolean = true) => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        if (useMilliseconds) {
            const milliseconds = timeInMs % 1000 / 10;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toFixed(0).padStart(2, '0')}`;
        } else {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    } else {
        if (useMilliseconds) {
            const milliseconds = timeInMs % 1000 / 10;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toFixed(0).padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
};

export const getCurrentTimestampISOString = () => new Date().toISOString();

export const formatCreatedAt = (createdAt: Date | number): string => {
    return typeof createdAt === 'number'
        ? new Date(createdAt).toISOString()
        : createdAt.toISOString();
};

export const getDaysAgoTimestampISOString = (daysAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
};

export const getEndOfDayTimestampISOString = (dateString: string) => {
    try {
        return dateString.split('T')[0] + 'T23:59:59.000Z';
    } catch (e) {
        console.log(e);
        return dateString;
    }
};

export const getStartOfDayTimestampISOString = (dateString: string) => {
    try {
        return dateString.split('T')[0] + 'T00:00:00.000Z';
    } catch (e) {
        console.log(e);
        return dateString;
    }
};
