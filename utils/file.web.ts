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
  return tempUri;
}

export async function deleteExerciseImage(imageUri: string): Promise<void> {}

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

export async function openCropperAsync(options: any) {
  return options.imageUri;
}
