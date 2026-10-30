import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

import { pickTextFile } from '@/utils/pickTextFile';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }));

const mockPick = DocumentPicker.getDocumentAsync as jest.Mock;
const mockRead = readAsStringAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('pickTextFile', () => {
  it('offers every file type, because Android reports .json as octet-stream', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });

    await pickTextFile({ maxBytes: 100 });

    expect(mockPick).toHaveBeenCalledWith({ type: '*/*', copyToCacheDirectory: true });
  });

  it('reports a dismissed picker, and one that returned nothing, as cancelled', async () => {
    mockPick.mockResolvedValueOnce({ canceled: true, assets: null });
    await expect(pickTextFile({ maxBytes: 100 })).resolves.toEqual({ status: 'cancelled' });

    mockPick.mockResolvedValueOnce({ canceled: false, assets: [] });
    await expect(pickTextFile({ maxBytes: 100 })).resolves.toEqual({ status: 'cancelled' });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('refuses a file that is too large before reading it', async () => {
    mockPick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.json', name: 'big.json', size: 101 }],
    });

    await expect(pickTextFile({ maxBytes: 100 })).resolves.toEqual({ status: 'tooLarge' });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('returns the text and name of a small file', async () => {
    mockPick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.json', name: 'musclog-onboarding.json', size: 12 }],
    });
    mockRead.mockResolvedValue('{"a":1}');

    await expect(pickTextFile({ maxBytes: 100 })).resolves.toEqual({
      status: 'picked',
      text: '{"a":1}',
      name: 'musclog-onboarding.json',
    });
    expect(mockRead).toHaveBeenCalledWith('file:///a.json');
  });

  it('still guards a file whose size the picker did not report', async () => {
    mockPick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///x', name: 'x', size: undefined }],
    });
    mockRead.mockResolvedValue('x'.repeat(101));

    await expect(pickTextFile({ maxBytes: 100 })).resolves.toEqual({ status: 'tooLarge' });
  });
});
