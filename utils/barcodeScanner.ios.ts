import BarcodeScanning, {
  type Barcode,
  BarcodeFormat,
} from '@react-native-ml-kit/barcode-scanning';

const SUPPORTED_PRODUCT_BARCODE_FORMATS = new Set<BarcodeFormat>([
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]);

function getFirstSupportedBarcodeValue(barcodes: Barcode[]): string | null {
  const matchedBarcode = barcodes.find(
    (barcode) =>
      SUPPORTED_PRODUCT_BARCODE_FORMATS.has(barcode.format) && barcode.value.trim().length > 0
  );

  return matchedBarcode?.value ?? null;
}

/**
 * Detect barcodes in an image on iOS.
 *
 * This implementation uses Google ML Kit via @react-native-ml-kit/barcode-scanning
 * to scan a local image URI for common product barcode formats.
 *
 * @param imageUri - URI of the image to scan for barcodes
 * @returns The first detected barcode value, or null if none found
 */
export async function detectBarcodes(imageUri: string): Promise<string | null> {
  const barcodes = await BarcodeScanning.scan(imageUri);

  return getFirstSupportedBarcodeValue(barcodes);
}
