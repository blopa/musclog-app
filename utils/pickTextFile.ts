import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

export type PickTextFileResult =
  | { status: 'picked'; text: string; name: string }
  | { status: 'cancelled' }
  | { status: 'tooLarge' };

/**
 * Lets the person choose a small text file (a setup file from ChatGPT or Claude). Any file type is
 * offered because Android reports a downloaded `.json` as `application/octet-stream`, which a JSON
 * filter would hide. The size is checked before the file is read, so a wrong, huge file is refused
 * rather than loaded into memory; whether it is the right kind of file is the caller's validation.
 */
export async function pickTextFile({
  maxBytes,
}: {
  maxBytes: number;
}): Promise<PickTextFileResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) {
    return { status: 'cancelled' };
  }

  if (typeof asset.size === 'number' && asset.size > maxBytes) {
    return { status: 'tooLarge' };
  }

  const text = await readAsStringAsync(asset.uri);
  // Some providers report no size, so the length check also guards the unknown-size case.
  return text.length > maxBytes
    ? { status: 'tooLarge' }
    : { status: 'picked', text, name: asset.name };
}
