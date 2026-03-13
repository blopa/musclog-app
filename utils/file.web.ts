import Quagga from '@ericblade/quagga2';
import { router } from 'expo-router';

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
        resolve();
        await reloadApp();
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

export async function pickDocument(types?: string[]): Promise<{ canceled: boolean; assets?: { name: string; uri: string; size?: number; mimeType?: string }[] }> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    
    // Convert types array to accept attribute format
    if (types && types.length > 0) {
      input.accept = types.join(',');
    } else {
      input.accept = 'image/*,application/pdf,text/plain';
    }
    
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve({ canceled: true });
        return;
      }

      // Create a URL for the file
      const uri = URL.createObjectURL(file);
      
      resolve({
        canceled: false,
        assets: [{
          name: file.name,
          uri: uri,
          size: file.size,
          mimeType: file.type,
        }],
      });
    };
    
    // Handle case where user cancels the file dialog
    input.oncancel = () => {
      resolve({ canceled: true });
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

export async function reloadApp() {
  router.replace('/');
  window.location.reload();
}
