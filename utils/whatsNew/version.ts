type Version = readonly [number, number, number];

export function parseVersion(value: unknown): Version | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? (parts as unknown as Version) : null;
}

export function parseAppVersion(value: string): Version | null {
  return parseVersion(value.split('-')[0]);
}

export function compareVersions(a: string, b: string): number {
  const left = parseAppVersion(a);
  const right = parseAppVersion(b);
  if (!left || !right) {
    throw new Error(`Invalid version: ${!left ? a : b}`);
  }

  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1;
    }
  }

  return 0;
}

export function nextSeenThrough(stored: string | null, current: string): string {
  const parsed = parseAppVersion(current);
  if (!parsed) {
    throw new Error(`Invalid app version: ${current}`);
  }

  return stored && parseVersion(stored) && compareVersions(stored, current) > 0
    ? stored
    : parsed.join('.');
}
