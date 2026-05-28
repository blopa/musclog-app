import { StorageAccessFramework } from 'expo-file-system';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';

export async function requestDirectoryPermission() {
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (permissions.granted) {
    return permissions.directoryUri;
  }
  return null;
}

export async function saveToSaf(
  directoryUri: string,
  folderName: string,
  files: { name: string; mimeType: string; content?: string; sourceUri?: string; isBinary?: boolean }[]
) {
  // 1. Create the session folder
  const sessionDirUri = await StorageAccessFramework.makeDirectoryAsync(directoryUri, folderName);

  for (const file of files) {
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
  }

  return sessionDirUri;
}
