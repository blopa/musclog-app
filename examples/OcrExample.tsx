/**
 * Example: Using the OCR Service with Guten OCR
 *
 * Platform-specific behavior:
 * - iOS: Uses Guten OCR (ONNX Runtime) - works perfectly on arm64 simulators
 * - Android: Uses Guten OCR (ONNX Runtime) - works on all devices
 *
 * Advantages over previous approaches:
 * - No ML Kit architecture mismatch on Apple Silicon simulators
 * - Fully offline, on-device processing
 * - Cross-platform consistency
 *
 * Usage in a component:
 */

import { useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';

import { useOcr } from '@/hooks/useOcr';

export function OcrExample() {
  const { result, loading, error, isInitialized, recognizeText, initialize } = useOcr({
    autoInitialize: true,
    language: 'eng',
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    // TODO: Integrate with expo-image-picker to select an image
    // For now, we'll use a placeholder path
    setSelectedImage('file:///path/to/image.jpg');
  };

  const handleRecognizeText = async () => {
    if (!selectedImage) {
      alert('Please select an image first');
      return;
    }

    try {
      // Explicitly initialize if needed
      if (!isInitialized) {
        await initialize('eng');
      }

      // Perform OCR recognition
      const result = await recognizeText(selectedImage, 'eng');

      console.log('Recognized text:', result.text);
      console.log('Processing time:', result.processingTimeMs, 'ms');
      console.log('Full result:', result);
    } catch (err) {
      console.error('OCR failed:', err);
      alert(`OCR failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>OCR Recognition</Text>

      {/* Status Indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text>Status:</Text>
        {isInitialized ? (
          <Text style={{ color: 'green' }}>✓ Ready</Text>
        ) : (
          <Text style={{ color: 'orange' }}>Initializing...</Text>
        )}
      </View>

      {/* Pick Image Button */}
      <Button title="Pick Image" onPress={handlePickImage} disabled={!isInitialized} />

      {/* Selected Image Display */}
      {selectedImage ? (
        <Text style={{ fontSize: 12, color: '#666' }}>
          Selected: {selectedImage.split('/').pop()}
        </Text>
      ) : null}

      {/* Recognize Button */}
      <Button
        title={loading ? 'Recognizing...' : 'Recognize Text'}
        onPress={handleRecognizeText}
        disabled={!selectedImage || loading || !isInitialized}
      />

      {/* Loading Indicator */}
      {loading ? <ActivityIndicator size="large" color="#0000ff" /> : null}

      {/* Results */}
      {result ? (
        <View
          style={{
            backgroundColor: '#f5f5f5',
            padding: 12,
            borderRadius: 8,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: '600' }}>Recognized Text:</Text>
          <Text selectable>{result.text}</Text>

          {result.processingTimeMs ? (
            <Text style={{ fontSize: 12, color: '#666' }}>
              Processing time: {result.processingTimeMs}ms
            </Text>
          ) : null}

          {/* Block Details (if available) */}
          {result.blocks && result.blocks.length > 0 ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ fontWeight: '500', fontSize: 12 }}>
                Blocks detected: {result.blocks.length}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Error Display */}
      {error ? <Text style={{ color: 'red', fontSize: 12 }}>Error: {error.message}</Text> : null}
    </View>
  );
}

/**
 * For direct service usage without a hook:
 *
 * import * as OcrService from '@/services/OcrService';
 *
 * // Initialize once on app start
 * await OcrService.initializeOcr('eng');
 *
 * // Perform recognition
 * const result = await OcrService.recognizeText('file:///path/to/image.jpg');
 * console.log(result.text);
 *
 * // Get available languages
 * const languages = await OcrService.getAvailableLanguages();
 *
 * // Cleanup
 * await OcrService.terminateOcr();
 */
