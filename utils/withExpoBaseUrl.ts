/** Prefixes a root-relative asset path when Expo exports beneath a non-root base URL. */
export function withExpoBaseUrl(path: string, base = process.env.EXPO_BASE_URL): string {
  if (/^https?:\/\//i.test(path) || !base) {
    return path;
  }

  const basePath = base.replace(/^\/+|\/+$/g, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!basePath) {
    return normalized;
  }
  if (normalized === `/${basePath}` || normalized.startsWith(`/${basePath}/`)) {
    return normalized;
  }

  return `/${basePath}${normalized}`;
}
