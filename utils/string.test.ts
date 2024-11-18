import {
    formatFloatNumericInputText,
    formatIntegerNumericInputText,
    generateHash,
    isString,
    normalizeName,
    safeToFixed,
} from './string';

describe('Utils Functions', () => {
    describe('generateHash', () => {
        test('generates hash of default length 32', () => {
            const hash = generateHash();
            expect(hash).toHaveLength(32);
            expect(hash).toMatch(/^[\w\-]+$/);
        });

        test('generates hash of specified length', () => {
            const length = 16;
            const hash = generateHash(length);
            expect(hash).toHaveLength(length);
            expect(hash).toMatch(/^[\w\-]+$/);
        });

        test('generates unique hashes', () => {
            const hash1 = generateHash();
            const hash2 = generateHash();
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('normalizeName', () => {
        test('normalizes names correctly', () => {
            expect(normalizeName('John Doe')).toBe('johndoe');
            expect(normalizeName('John-Doe')).toBe('johndoe');
            expect(normalizeName('John.Doe')).toBe('johndoe');
            expect(normalizeName('John_Doe')).toBe('johndoe');
            expect(normalizeName('John Doe 123')).toBe('johndoe123');
        });

        test('removes non-alphanumeric characters', () => {
            expect(normalizeName('John@Doe!')).toBe('johndoe');
            expect(normalizeName('John#Doe$')).toBe('johndoe');
            expect(normalizeName('John%Doe^')).toBe('johndoe');
        });

        test('converts to lowercase', () => {
            expect(normalizeName('JohnDoe')).toBe('johndoe');
            expect(normalizeName('JOHNDOE')).toBe('johndoe');
        });
    });

    describe('safeToFixed', () => {
        test('returns fixed number', () => {
            expect(safeToFixed(1.2345)).toBe('1.23');
            expect(safeToFixed(1.2345, 3)).toBe('1.234');
        });

        test('returns string if error occurs', () => {
            expect(safeToFixed('string')).toBe('0.00');
        });
    });

    describe('formatFloatNumericInputText', () => {
        test('formats number correctly', () => {
            expect(formatFloatNumericInputText('1234')).toBe('1234');
            expect(formatFloatNumericInputText('1234.56')).toBe('1234.56');
        });

        test('returns null for invalid number', () => {
            expect(formatFloatNumericInputText('abc')).toBeNull();
            expect(formatFloatNumericInputText('12.34.56')).toBeNull();
            expect(formatFloatNumericInputText('12,34,56')).toBeNull();
        });

        test('handles empty input', () => {
            expect(formatFloatNumericInputText('')).toBe('');
        });

        test('handles input with only decimal separator', () => {
            expect(formatFloatNumericInputText('.')).toBeNull();
        });
    });

    describe('formatIntegerNumericInputText', () => {
        test('formats integer correctly', () => {
            expect(formatIntegerNumericInputText('1234')).toBe('1234');
            expect(formatIntegerNumericInputText('12,34')).toBeNull();
        });

        test('returns null for invalid integer', () => {
            expect(formatIntegerNumericInputText('abc')).toBeNull();
            expect(formatIntegerNumericInputText('1234.56')).toBeNull();
            expect(formatIntegerNumericInputText('12,34.56')).toBeNull();
        });

        test('handles empty input', () => {
            expect(formatIntegerNumericInputText('')).toBe('');
        });
    });

    describe('isString', () => {
        test('returns true for string', () => {
            expect(isString('string')).toBe(true);
        });

        test('returns false for non-string', () => {
            expect(isString(123)).toBe(false);
            expect(isString(true)).toBe(false);
            expect(isString({})).toBe(false);
            expect(isString([])).toBe(false);
        });
    });
});
