import Quagga from '@ericblade/quagga2';

import { dumpDatabase, restoreDatabase } from '../database/exportImport';

function getExportFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${timestamp}-musclog-export.json`;
}

export async function exportDatabase(encryptionPhrase?: string): Promise<void> {
  const dbDump = await dumpDatabase(encryptionPhrase);
  const fileName = getExportFileName();
  const blob = new Blob([dbDump], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(decryptionPhrase?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve();
        return;
      }
      try {
        const dbDump = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(String(reader.result ?? ''));
          reader.onerror = () => rej(reader.error);
          reader.readAsText(file);
        });
        await restoreDatabase(dbDump, decryptionPhrase);
        window.location.reload();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

export async function resizeImage(photoUri: string, width: number = 256): Promise<string> {
  try {
    const image = new Image();
    image.src = photoUri;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = (err) => reject(err);
    });

    const aspectRatio = image.height / image.width;
    const newHeight = Math.round(width * aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    ctx.drawImage(image, 0, 0, width, newHeight);

    return canvas.toDataURL();
  } catch (error) {
    console.error('Failed to resize image:', error);
    throw new Error('Failed to resize image');
  }
}

export async function saveExerciseImage(tempUri: string, existingUri?: string): Promise<string> {
  // Not really necessary to be implemented for web
  return tempUri;
}

export async function deleteExerciseImage(imageUri: string): Promise<void> {
  // Not really necessary to be implemented for web
}

export async function detectBarcodes(imageUri: string) {
  const quaggaResult = await Quagga.decodeSingle({
    src: imageUri,
    numOfWorkers: 0,
    decoder: { readers: ['ean_reader', 'ean_8_reader'] },
    inputStream: {
      size: 800,
      area: {
        top: '10%',
        right: '5%',
        left: '5%',
        bottom: '10%',
      },
    },
    locator: {
      patchSize: 'large',
      halfSample: true,
    },
  });

  return quaggaResult?.codeResult?.code ?? null;
}

export async function openCropperAsync(options: any): Promise<{ path: string }> {
  return { path: options.imageUri };
}

export async function readFileAsStringAsync(fileUri: string, options: { encoding?: string } = {}) {
  try {
    // Fetch the file from the URI
    const response = await fetch(fileUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const blob = await response.blob();

    // If encoding is 'base64', convert to base64
    if (options.encoding === 'base64') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Default: return as text
    return await blob.text();
  } catch (error) {
    console.error('[file.web.ts] Error reading file:', error);
    throw error;
  }
}

// Import all exercise images to ensure they're bundled
const EXERCISE_IMAGES: Record<string, any> = {
  '1': require('../assets/exercises/1.webp'),
  '2': require('../assets/exercises/2.webp'),
  '3': require('../assets/exercises/3.webp'),
  '4': require('../assets/exercises/4.webp'),
  '5': require('../assets/exercises/5.webp'),
  '6': require('../assets/exercises/6.webp'),
  '7': require('../assets/exercises/7.webp'),
  '8': require('../assets/exercises/8.webp'),
  '9': require('../assets/exercises/9.webp'),
  '10': require('../assets/exercises/10.webp'),
  '11': require('../assets/exercises/11.webp'),
  '12': require('../assets/exercises/12.webp'),
  '13': require('../assets/exercises/13.webp'),
  '14': require('../assets/exercises/14.webp'),
  '15': require('../assets/exercises/15.webp'),
  '16': require('../assets/exercises/16.webp'),
  '17': require('../assets/exercises/17.webp'),
  '18': require('../assets/exercises/18.webp'),
  '19': require('../assets/exercises/19.webp'),
  '20': require('../assets/exercises/20.webp'),
  '21': require('../assets/exercises/21.webp'),
  '22': require('../assets/exercises/22.webp'),
  '23': require('../assets/exercises/23.webp'),
  '24': require('../assets/exercises/24.webp'),
  '25': require('../assets/exercises/25.webp'),
  '26': require('../assets/exercises/26.webp'),
  '27': require('../assets/exercises/27.webp'),
  '28': require('../assets/exercises/28.webp'),
  '29': require('../assets/exercises/29.webp'),
  '30': require('../assets/exercises/30.webp'),
  '31': require('../assets/exercises/31.webp'),
  '32': require('../assets/exercises/32.webp'),
  '33': require('../assets/exercises/33.webp'),
  '34': require('../assets/exercises/34.webp'),
  '38': require('../assets/exercises/38.webp'),
  '39': require('../assets/exercises/39.webp'),
  '41': require('../assets/exercises/41.webp'),
  '47': require('../assets/exercises/47.webp'),
  '48': require('../assets/exercises/48.webp'),
  '49': require('../assets/exercises/49.webp'),
  '51': require('../assets/exercises/51.webp'),
  '52': require('../assets/exercises/52.webp'),
  '53': require('../assets/exercises/53.webp'),
  '64': require('../assets/exercises/64.webp'),
  '65': require('../assets/exercises/65.webp'),
  '84': require('../assets/exercises/84.webp'),
  '85': require('../assets/exercises/85.webp'),
  '86': require('../assets/exercises/86.webp'),
  '89': require('../assets/exercises/89.webp'),
  '90': require('../assets/exercises/90.webp'),
  '91': require('../assets/exercises/91.webp'),
  '94': require('../assets/exercises/94.webp'),
  '105': require('../assets/exercises/105.webp'),
};

const FALLBACK_IMAGE = require('../assets/exercises/fallback.webp');

export function getExerciseImageUri(exerciseId: string | undefined | null): string {
  // Return the specific exercise image if it exists, otherwise return the fallback
  if (exerciseId != null && EXERCISE_IMAGES[exerciseId] != null) {
    return EXERCISE_IMAGES[exerciseId];
  }

  return FALLBACK_IMAGE;
}
