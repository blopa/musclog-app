/**
 * expo-file-system's `File.copy` needs an absolute URI (a scheme). A bundled asset's `localUri` can
 * come back as a plain path (`/data/user/0/…`) in a release build, which the native side rejects
 * with "URI is not absolute"; a bare path becomes a `file://` URI, anything with a scheme is kept.
 */
export function absoluteFileUri(uri: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri)) {
    return uri;
  }

  return uri.startsWith('/') ? `file://${uri}` : uri;
}
