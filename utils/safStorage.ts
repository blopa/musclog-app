import { Directory, File } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

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

// Copies a set of source files into a freshly-created subfolder inside a
// user-granted SAF tree URI. Uses the SDK 56+ File.copy() API, which streams
// natively to SAF content:// destinations — no full-file load into JS memory,
// so multi-MB videos work fine.
export async function saveToSaf(
  directoryUri: string,
  folderName: string,
  files: { name: string; mimeType: string; sourceUri: string }[]
) {
  if (Platform.OS !== 'android') {
    return null;
  }

  const safDir = new Directory(directoryUri);
  const sessionDir = safDir.createDirectory(folderName);

  for (const file of files) {
    const sourceFile = new File(file.sourceUri);
    const destFile = sessionDir.createFile(file.name, file.mimeType);
    await sourceFile.copy(destFile, { overwrite: true });
  }

  return sessionDir.uri;
}
