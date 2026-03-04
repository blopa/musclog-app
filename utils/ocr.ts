import { recognizeText } from 'rn-mlkit-ocr';

async function scanImage(imageUri: string) {
  try {
    // Correct method: recognizeText
    const result = await recognizeText(imageUri);

    console.log('Recognized text:', result.text);

    // You can also loop through the blocks for more detailed coordinates
    // result.blocks.forEach((block) => { ... })
  } catch (error) {
    console.error('OCR Error:', error);
  }
}
