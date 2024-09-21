import { generateExerciseImage } from '@/utils/ai';
import exerciseImages from '@/utils/exerciseImages';
import { downloadAsyncToFileSystem, getFileInfoForExerciseId, getFileUriForExerciseId } from '@/utils/file';
import { ExerciseReturnType } from '@/utils/types';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';

const useWorkoutImage = (exercise?: ExerciseReturnType) => {
    const [imageUrl, setImageUrl] = useState('https://via.placeholder.com/300');

    useEffect(() => {
        const checkAndDownloadImage = async () => {
            if (exercise) {
                try {
                    const localFilePath = getFileUriForExerciseId(exercise.id!);
                    const fileInfo = await getFileInfoForExerciseId(exercise.id!);

                    if (exerciseImages[exercise.id!]) {
                        const asset = Asset.fromModule(exerciseImages[exercise.id!]);
                        setImageUrl(asset.uri);
                        return;
                    }

                    if (fileInfo?.exists) {
                        setImageUrl(localFilePath);
                    } else {
                        const generatedImageUrl = await generateExerciseImage(exercise.name);
                        if (generatedImageUrl) {
                            setImageUrl(generatedImageUrl);
                            await downloadImage(generatedImageUrl, localFilePath);
                        } else {
                            setImageUrl(Asset.fromModule(exerciseImages.fallback).uri);
                        }
                    }
                } catch (error) {
                    console.error('Error checking or downloading image:', error);
                    setImageUrl(Asset.fromModule(exerciseImages.fallback).uri);
                }
            }
        };

        const downloadImage = async (imageUrl: string, localFilePath: string) => {
            try {
                const downloadResult = await downloadAsyncToFileSystem(imageUrl, localFilePath);

                if (downloadResult?.status === 200) {
                    setImageUrl(localFilePath);
                } else {
                    console.error('Failed to download image:', downloadResult);
                    setImageUrl(Asset.fromModule(exerciseImages.fallback).uri);
                }
            } catch (error) {
                console.error('Error downloading image:', error);
                setImageUrl(Asset.fromModule(exerciseImages.fallback).uri);
            }
        };

        if (exercise?.id && exercise?.name) {
            checkAndDownloadImage();
        }
    }, [exercise]);

    return { imageUrl };
};

export default useWorkoutImage;
