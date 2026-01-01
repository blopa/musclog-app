import {
    CENTIMETERS,
    FEET,
    GRAMS,
    INCHES,
    KILOGRAMS,
    METERS,
    METRIC_SYSTEM,
    OUNCES,
    POUNDS,
    UNIT_CHOICE_TYPE,
} from '@/constants/storage';
import { getSetting } from '@/utils/database';
import { safeToFixed } from '@/utils/string';

export const getUnit = async () => {
    const unit = await getSetting(UNIT_CHOICE_TYPE);
    const unitSystem = unit?.value || METRIC_SYSTEM;

    return {
        heightUnit: unitSystem === METRIC_SYSTEM ? METERS : FEET,
        unitSystem,
        weightUnit: unitSystem === METRIC_SYSTEM ? KILOGRAMS : POUNDS,
    };
};

const convertToMetric = (value: number, unit: string): number => {
    switch (unit) {
        case FEET: {
            return parseFloat(safeToFixed(value * 0.3048));
        }
        case INCHES: {
            return parseFloat(safeToFixed(value * 2.54));
        }
        case OUNCES: {
            return parseFloat(safeToFixed(value * 0.0283495));
        }
        case POUNDS: {
            return parseFloat(safeToFixed(value * 0.453592));
        }
        default: {
            return parseFloat(safeToFixed(value));
        }
    }
};

const convertToImperial = (value: number, inputUnit: string): number => {
    switch (inputUnit) {
        case CENTIMETERS:
            return parseFloat(safeToFixed(value / 2.54));
        case GRAMS:
            return parseFloat(safeToFixed(value / 28.3495));
        case KILOGRAMS:
            return parseFloat(safeToFixed(value / 0.453592));
        case METERS:
            return parseFloat(safeToFixed(value / 0.3048));
        default:
            return parseFloat(safeToFixed(value));
    }
};

export const getDisplayFormattedWeight = (
    value: number,
    inputUnit: string,
    isImperial: boolean
): number => {
    if (isImperial) {
        return convertToImperial(value, inputUnit);
    }

    return Math.round(value * 100) / 100;
};

export const getDisplayFormattedHeight = (
    value: number,
    isImperial: boolean
): number => {
    if (isImperial) {
        return Math.round((convertToImperial(value * 100, CENTIMETERS) / 12) * 100) / 100;
    }

    return Math.round(value * 100) / 100;
};

export const getSaveFormattedWeight = (
    value: number,
    inputUnit: string,
    isImperial: boolean
): number => {
    if (isImperial) {
        return convertToMetric(value, inputUnit);
    }

    return Math.round(value * 100) / 100;
};

export const getSaveFormattedHeight = (
    value: number,
    isImperial: boolean
): number => {
    if (isImperial) {
        return Math.round((convertToMetric(value, FEET) * 100)) / 100;
    }

    return Math.round(value * 100) / 100;
};
