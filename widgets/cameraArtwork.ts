import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { absoluteFileUri } from './absoluteFileUri';

/**
 * The bundled artwork as a file URI that `File.copy` accepts, or `''` when there is none.
 *
 * A release Android build reports a bundled image as a bare drawable resource name
 * (`assets_camerawidget`) that it already calls downloaded, and only the asset module can open it.
 * Asking for the same content under a fresh asset makes it write the file to the cache (keyed by
 * the artwork's hash, so a changed artwork gets a new file).
 */
async function artworkFileUri(): Promise<string> {
  const asset = await Asset.fromModule(require('../assets/camera-widget.png')).downloadAsync();
  const { localUri } = asset;
  if (!localUri) {
    return '';
  }

  if (localUri.includes(':') || localUri.startsWith('/')) {
    return absoluteFileUri(localUri);
  }

  const { name, type, hash } = asset;
  const cached = await new Asset({ name, type, hash, uri: localUri }).downloadAsync();

  return cached.localUri ? absoluteFileUri(cached.localUri) : '';
}

/**
 * Copies the Smart Camera widget's artwork into the folder the widgets can read, and answers its
 * URI, or `''` when there is none (a snapshot never carries a null). It is replaced once per launch
 * rather than only when missing, so a changed artwork reaches installs that already hold the old
 * file (a 1024px copy once broke the iOS tile for good).
 */
export async function copyCameraArtwork(directory: string): Promise<string> {
  const source = await artworkFileUri();
  const destination = new File(directory, 'smart-camera.png');
  if (source) {
    if (destination.exists) {
      destination.delete();
    }

    // Awaited: a copy that fails must reach the caller, never end as an unhandled rejection.
    await new File(source).copy(destination);
  }

  // A fresh handle: the one above still reports the state from before delete() and copy().
  const copied = new File(directory, 'smart-camera.png');

  return copied.exists ? copied.uri : '';
}
