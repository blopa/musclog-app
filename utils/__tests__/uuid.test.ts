import { generateUUID } from '@/utils/uuid';
import { randomUUID } from 'expo-crypto';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

describe('utils/uuid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUUID', () => {
    it('should use randomUUID from expo-crypto', () => {
      const mockUUID = 'native-uuid-1234-5678';
      (randomUUID as jest.Mock).mockReturnValue(mockUUID);

      const result = generateUUID();

      expect(result).toBe(mockUUID);
      expect(randomUUID).toHaveBeenCalledTimes(1);
    });

    it('should return different UUIDs on each call', () => {
      let callCount = 0;
      (randomUUID as jest.Mock).mockImplementation(() => {
        callCount++;
        return `native-uuid-${callCount}`;
      });

      const uuid1 = generateUUID();
      const uuid2 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(randomUUID).toHaveBeenCalledTimes(2);
    });
  });
});
