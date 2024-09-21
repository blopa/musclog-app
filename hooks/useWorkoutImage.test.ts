import { generateExerciseImage } from '@/utils/ai';
import exerciseImages from '@/utils/exerciseImages';
import { downloadAsyncToFileSystem, getFileInfoForExerciseId, getFileUriForExerciseId } from '@/utils/file';
import { ExerciseReturnType } from '@/utils/types';
import { act, renderHook } from '@testing-library/react';
import { Asset } from 'expo-asset';

import useWorkoutImage from './useWorkoutImage';

jest.mock('@/utils/ai', () => ({
    generateExerciseImage: jest.fn(),
}));

jest.mock('@/utils/exerciseImages', () => ({
    fallback: 'fallbackImage',
}));

jest.mock('@/utils/file', () => ({
    downloadAsyncToFileSystem: jest.fn(),
    getFileInfoForExerciseId: jest.fn(),
    getFileUriForExerciseId: jest.fn(),
}));

jest.mock('expo-asset', () => ({
    Asset: {
        fromModule: jest.fn(() => ({ uri: 'assetUri' })),
    },
}));

describe('useWorkoutImage', () => {
    const mockExercise: ExerciseReturnType = {
        id: 1,
        name: 'Test Exercise',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should use the fallback image if no exercise is provided', () => {
        const { result } = renderHook(() => useWorkoutImage());

        expect(result.current.imageUrl).toBe('https://via.placeholder.com/300');
    });

    it('should set image URL from local assets if exercise image exists', async () => {
        (exerciseImages as any)['test-exercise-id'] = 'localImage';
        (Asset.fromModule as jest.Mock).mockReturnValueOnce({ uri: 'localAssetUri' });

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('localAssetUri');
    });

    it('should set image URL from local file if it exists', async () => {
        (exerciseImages as any)['test-exercise-id'] = undefined;
        (getFileInfoForExerciseId as jest.Mock).mockResolvedValueOnce({ exists: true });
        (getFileUriForExerciseId as jest.Mock).mockReturnValueOnce('localFileUri');

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('localFileUri');
    });

    it('should generate and download image if local file does not exist', async () => {
        (exerciseImages as any)['test-exercise-id'] = undefined;
        (getFileInfoForExerciseId as jest.Mock).mockResolvedValueOnce({ exists: false });
        (getFileUriForExerciseId as jest.Mock).mockReturnValueOnce('localFileUri');
        (generateExerciseImage as jest.Mock).mockResolvedValueOnce('generatedImageUrl');
        (downloadAsyncToFileSystem as jest.Mock).mockResolvedValueOnce({ status: 200 });

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('localFileUri');
        expect(downloadAsyncToFileSystem).toHaveBeenCalledWith('generatedImageUrl', 'localFileUri');
    });

    it('should use fallback image if generation fails', async () => {
        (exerciseImages as any)['test-exercise-id'] = undefined;
        (getFileInfoForExerciseId as jest.Mock).mockResolvedValueOnce({ exists: false });
        (generateExerciseImage as jest.Mock).mockResolvedValueOnce(null);
        (Asset.fromModule as jest.Mock).mockReturnValueOnce({ uri: 'fallbackUri' });

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('fallbackUri');
    });

    it('should use fallback image if download fails', async () => {
        (exerciseImages as any)['test-exercise-id'] = undefined;
        (getFileInfoForExerciseId as jest.Mock).mockResolvedValueOnce({ exists: false });
        (generateExerciseImage as jest.Mock).mockResolvedValueOnce('generatedImageUrl');
        (downloadAsyncToFileSystem as jest.Mock).mockResolvedValueOnce({ status: 500 });
        (Asset.fromModule as jest.Mock).mockReturnValueOnce({ uri: 'fallbackUri' });

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('fallbackUri');
    });

    it('should handle errors and set fallback image', async () => {
        (exerciseImages as any)['test-exercise-id'] = undefined;
        (getFileInfoForExerciseId as jest.Mock).mockRejectedValueOnce(new Error('Error'));
        (Asset.fromModule as jest.Mock).mockReturnValueOnce({ uri: 'fallbackUri' });

        const { result } = renderHook(() => useWorkoutImage(mockExercise));

        await act(async () => {
            // Simulate the useEffect execution
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.imageUrl).toBe('fallbackUri');
    });
});
