import { downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { shareImage } from '../shareImage';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

describe('shareImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    Platform.OS = 'android';
  });

  it('shares a local photo as it is', async () => {
    await expect(shareImage('file:///docs/meal.jpg')).resolves.toBe('shared');

    expect(downloadAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///docs/meal.jpg', {
      mimeType: 'image/jpeg',
    });
  });

  it('downloads a remote photo first, because the share sheet needs a local file', async () => {
    (downloadAsync as jest.Mock).mockResolvedValue({ uri: 'file:///cache/musclog-photo-1.jpg' });

    await expect(shareImage('https://example.com/p.jpg')).resolves.toBe('shared');

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://example.com/p.jpg',
      expect.stringMatching(/^file:\/\/\/cache\/musclog-photo-\d+\.jpg$/)
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/musclog-photo-1.jpg', {
      mimeType: 'image/jpeg',
    });
  });

  it('reports "unavailable" when the device cannot share, without trying', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    await expect(shareImage('file:///a.jpg')).resolves.toBe('unavailable');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('never throws: a failed download or share is "failed"', async () => {
    (downloadAsync as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(shareImage('https://example.com/p.jpg')).resolves.toBe('failed');

    (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('cancelled'));
    await expect(shareImage('file:///a.jpg')).resolves.toBe('failed');
  });
});
