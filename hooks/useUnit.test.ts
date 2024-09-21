import { useLayoutReloader } from '@/storage/LayoutReloaderProvider';
import { useSettings } from '@/storage/SettingsContext';
import { act, renderHook } from '@testing-library/react';

import useUnit from './useUnit';

jest.mock('@/storage/LayoutReloaderProvider', () => ({
    useLayoutReloader: jest.fn(),
}));

jest.mock('@/storage/SettingsContext', () => ({
    useSettings: jest.fn(),
}));

describe('useUnit', () => {
    const METRIC_SYSTEM = 'metric';
    const IMPERIAL_SYSTEM = 'imperial';
    const KILOGRAMS = 'kg';
    const POUNDS = 'lb';
    const METERS = 'm';
    const FEET = 'ft';

    const mockReloadKey = 'test-reload-key';
    const mockGetSettingByType = jest.fn();
    const mockSettings = {};

    beforeEach(() => {
        jest.clearAllMocks();

        (useLayoutReloader as jest.Mock).mockReturnValue({ reloadKey: mockReloadKey });
        (useSettings as jest.Mock).mockReturnValue({
            getSettingByType: mockGetSettingByType,
            settings: mockSettings,
        });
    });

    it('should default to metric system', async () => {
        mockGetSettingByType.mockResolvedValueOnce(null);

        const { result } = renderHook(() => useUnit());

        await act(async () => {
            await mockGetSettingByType();
        });

        expect(result.current.unitSystem).toBe(METRIC_SYSTEM);
        expect(result.current.heightUnit).toBe(METERS);
        expect(result.current.weightUnit).toBe(KILOGRAMS);
    });

    it('should set unit system based on settings', async () => {
        mockGetSettingByType.mockResolvedValueOnce({ value: IMPERIAL_SYSTEM });

        const { result } = renderHook(() => useUnit());

        await act(async () => {
            await mockGetSettingByType();
        });

        expect(result.current.unitSystem).toBe(IMPERIAL_SYSTEM);
        expect(result.current.heightUnit).toBe(FEET);
        expect(result.current.weightUnit).toBe(POUNDS);
    });

    it('should update unit system when reloadKey changes', async () => {
        mockGetSettingByType.mockResolvedValueOnce({ value: METRIC_SYSTEM });

        const { rerender, result } = renderHook(() => useUnit());

        await act(async () => {
            await mockGetSettingByType();
        });

        expect(result.current.unitSystem).toBe(METRIC_SYSTEM);
        expect(result.current.heightUnit).toBe(METERS);
        expect(result.current.weightUnit).toBe(KILOGRAMS);

        mockGetSettingByType.mockResolvedValueOnce({ value: IMPERIAL_SYSTEM });
        (useLayoutReloader as jest.Mock).mockReturnValue({ reloadKey: 'new-reload-key' });

        rerender();

        await act(async () => {
            await mockGetSettingByType();
        });

        expect(result.current.unitSystem).toBe(IMPERIAL_SYSTEM);
        expect(result.current.heightUnit).toBe(FEET);
        expect(result.current.weightUnit).toBe(POUNDS);
    });
});
