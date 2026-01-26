import { ImageManipulator } from 'expo-image-manipulator';

export async function resizeImage(photoUri: string, width: number = 512): Promise<string> {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return manipulatedImage.uri;
}
