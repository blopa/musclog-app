import * as FileSystem from 'expo-file-system';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const { StorageAccessFramework } = FileSystem;

export async function requestDirectoryPermission() {
  if (Platform.OS !== 'android' || !StorageAccessFramework) {
    return null;
  }

  try {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      return permissions.directoryUri;
    }
  } catch (err) {
    console.error('[safStorage] requestDirectoryPermission error:', err);
    throw err; // Re-throw so the caller can show the error snackbar
  }
  return null;
}

export async function saveToSaf(
  directoryUri: string,
  folderName: string,
  files: { name: string; mimeType: string; content?: string; sourceUri?: string; isBinary?: boolean }[]
) {
  if (Platform.OS !== 'android' || !StorageAccessFramework) {
    return null;
  }

  // 1. Create the session folder
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
        const encoding = file.isBinary ? EncodingType.Base64 : EncodingType.UTF8;
        const content = await readAsStringAsync(file.sourceUri, { encoding });
        await StorageAccessFramework.writeAsStringAsync(fileUri, content, { encoding });
      }
    } catch (err) {
      console.error(`[safStorage] Failed to save file ${file.name}:`, err);
      // Continue with other files if one fails? Or throw?
      // Let's throw for now to be safe
      throw err;
    }
  }

  return sessionDirUri;
}
