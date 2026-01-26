import { ImageManipulator } from 'expo-image-manipulator';
import { BarcodeFormat, detectBarcodes as RNDetectBarcodes } from 'react-native-barcodes-detector';

export async function resizeImage(photoUri: string, width: number = 512): Promise<string> {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return manipulatedImage.uri;
}

export async function detectBarcodes(imageUri: string) {
  const barcodes = await RNDetectBarcodes(imageUri, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);

  return barcodes.length > 0 ? barcodes[0].rawValue : null;
}
