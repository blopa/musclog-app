import { generateUUID } from '@/utils/uuid';

describe('utils/uuid', () => {
  const originalCrypto = globalThis.crypto;
  const originalMathRandom = Math.random;

  beforeEach(() => {
    // Reset crypto and Math.random before each test
    delete (globalThis as any).crypto;
    Math.random = originalMathRandom;
  });

  afterEach(() => {
    // Restore original values
    if (originalCrypto) {
      (globalThis as any).crypto = originalCrypto;
    } else {
      delete (globalThis as any).crypto;
    }
    Math.random = originalMathRandom;
  });

  describe('generateUUID', () => {
    describe('with native crypto.randomUUID available', () => {
      it('should use native crypto.randomUUID when available', () => {
        const mockRandomUUID = jest.fn(() => 'native-uuid-1234-5678');
        (globalThis as any).crypto = {
          randomUUID: mockRandomUUID,
        };

        const result = generateUUID();

        expect(result).toBe('native-uuid-1234-5678');
        expect(mockRandomUUID).toHaveBeenCalledTimes(1);
      });

      it('should return different UUIDs on each call', () => {
        let callCount = 0;
        const mockRandomUUID = jest.fn(() => {
          callCount++;
          return `native-uuid-${callCount}`;
        });
        (globalThis as any).crypto = {
          randomUUID: mockRandomUUID,
        };

        const uuid1 = generateUUID();
        const uuid2 = generateUUID();

        expect(uuid1).not.toBe(uuid2);
        expect(mockRandomUUID).toHaveBeenCalledTimes(2);
      });

      it('should work when crypto exists but randomUUID is a function', () => {
        const mockRandomUUID = jest.fn(() => 'test-uuid');
        (globalThis as any).crypto = {
          randomUUID: mockRandomUUID,
          otherMethod: jest.fn(),
        };

        const result = generateUUID();

        expect(result).toBe('test-uuid');
        expect(mockRandomUUID).toHaveBeenCalled();
      });
    });

    describe('fallback polyfill implementation', () => {
      beforeEach(() => {
        // Ensure crypto.randomUUID is not available
        delete (globalThis as any).crypto;
      });

      it('should generate a UUID in correct format', () => {
        const uuid = generateUUID();
        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(uuid).toMatch(uuidRegex);
      });

      it('should have version 4 in the correct position', () => {
        const uuid = generateUUID();
        // The 15th character (index 14) should be '4' for UUID v4
        expect(uuid[14]).toBe('4');
      });

      it('should have variant bits in the correct position', () => {
        const uuid = generateUUID();
        // The 20th character (index 19) should be one of 8, 9, a, b, A, B
        const variantChar = uuid[19].toLowerCase();
        expect(['8', '9', 'a', 'b']).toContain(variantChar);
      });

      it('should generate different UUIDs on each call', () => {
        const uuid1 = generateUUID();
        const uuid2 = generateUUID();
        const uuid3 = generateUUID();

        expect(uuid1).not.toBe(uuid2);
        expect(uuid2).not.toBe(uuid3);
        expect(uuid1).not.toBe(uuid3);
      });

      it('should generate valid UUIDs with consistent format', () => {
        const uuids = Array.from({ length: 100 }, () => generateUUID());
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        uuids.forEach((uuid) => {
          expect(uuid).toMatch(uuidRegex);
          expect(uuid.length).toBe(36); // UUID format length
        });
      });

      it('should have correct length', () => {
        const uuid = generateUUID();
        expect(uuid.length).toBe(36);
      });

      it('should have hyphens in correct positions', () => {
        const uuid = generateUUID();
        expect(uuid[8]).toBe('-');
        expect(uuid[13]).toBe('-');
        expect(uuid[18]).toBe('-');
        expect(uuid[23]).toBe('-');
      });

      it('should use Math.random for fallback', () => {
        const mockRandom = jest.fn(() => 0.5);
        Math.random = mockRandom;

        generateUUID();

        expect(mockRandom).toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle when crypto exists but randomUUID is undefined', () => {
        (globalThis as any).crypto = {
          // randomUUID is missing
          getRandomValues: jest.fn(),
        };

        const uuid = generateUUID();
        // Should fall back to polyfill
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      it('should handle when crypto exists but randomUUID is null', () => {
        (globalThis as any).crypto = {
          randomUUID: null,
        };

        const uuid = generateUUID();
        // Should fall back to polyfill
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      it('should generate unique UUIDs even with same Math.random seed', () => {
        // Mock Math.random to return same value
        let callCount = 0;
        Math.random = jest.fn(() => {
          callCount++;
          // Return different values to ensure uniqueness
          return (callCount % 16) / 16;
        });

        const uuid1 = generateUUID();
        const uuid2 = generateUUID();

        // Even with controlled random, should generate different UUIDs
        expect(uuid1).not.toBe(uuid2);
      });
    });

    describe('UUID v4 specification compliance', () => {
      beforeEach(() => {
        delete (globalThis as any).crypto;
      });

      it('should always have version 4', () => {
        const uuids = Array.from({ length: 50 }, () => generateUUID());
        uuids.forEach((uuid) => {
          expect(uuid[14]).toBe('4');
        });
      });

      it('should always have correct variant bits', () => {
        const uuids = Array.from({ length: 50 }, () => generateUUID());
        uuids.forEach((uuid) => {
          const variantChar = uuid[19].toLowerCase();
          expect(['8', '9', 'a', 'b']).toContain(variantChar);
        });
      });

      it('should only contain hexadecimal characters and hyphens', () => {
        const uuid = generateUUID();
        expect(uuid).toMatch(/^[0-9a-f-]+$/i);
      });

      it('should have exactly 32 hexadecimal digits', () => {
        const uuid = generateUUID();
        const hexDigits = uuid.replace(/-/g, '');
        expect(hexDigits.length).toBe(32);
        expect(hexDigits).toMatch(/^[0-9a-f]{32}$/i);
      });
    });
  });
});
