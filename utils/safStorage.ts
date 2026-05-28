import { File, FileMode } from 'expo-file-system';
import { EncodingType, readAsStringAsync, StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const SAF_COPY_CHUNK_BYTES = 1024 * 1024; // 1 MB per chunk — no full-file load into memory

// Streams a file:// source into an already-created SAF content:// destination.
// The new FileHandle API routes SAF document URIs through ContentResolver so both
// ends can be driven with readBytes/writeBytes without allocating the whole file.
function streamCopyToSaf(sourceUri: string, safDestUri: string): void {
  const sourceHandle = new File(sourceUri).open(FileMode.ReadOnly);
  const destHandle = new File(safDestUri).open(FileMode.WriteOnly);
  try {
    while (true) {
      const chunk = sourceHandle.readBytes(SAF_COPY_CHUNK_BYTES);
      if (chunk.length === 0) {
        break;
      }
      destHandle.writeBytes(chunk);
    }
  } finally {
    sourceHandle.close();
    destHandle.close();
  }
}

export async function requestDirectoryPermission() {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      return permissions.directoryUri;
    }
  } catch (err) {
    console.error('[safStorage] requestDirectoryPermission error:', err);
    throw err;
  }
  return null;
}

export async function saveToSaf(
  directoryUri: string,
  folderName: string,
  files: {
    name: string;
    mimeType: string;
    content?: string;
    sourceUri?: string;
    isBinary?: boolean;
  }[]
) {
  if (Platform.OS !== 'android') {
    return null;
  }

  const sessionDirUri = await StorageAccessFramework.makeDirectoryAsync(directoryUri, folderName);

  for (const file of files) {
    try {
      const fileUri = await StorageAccessFramework.createFileAsync(
        sessionDirUri,
        file.name,
        file.mimeType
      );

      if (file.content) {
        await StorageAccessFramework.writeAsStringAsync(fileUri, file.content, {
          encoding: EncodingType.UTF8,
        });
      } else if (file.sourceUri) {
        if (file.isBinary) {
          streamCopyToSaf(file.sourceUri, fileUri);
        } else {
          const content = await readAsStringAsync(file.sourceUri, { encoding: EncodingType.UTF8 });
          await StorageAccessFramework.writeAsStringAsync(fileUri, content, {
            encoding: EncodingType.UTF8,
          });
        }
      }
    } catch (err) {
      console.error(`[safStorage] Failed to save file ${file.name}:`, err);
      throw err;
    }
  }

  return sessionDirUri;
}
