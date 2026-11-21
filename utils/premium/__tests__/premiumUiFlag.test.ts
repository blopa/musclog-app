import fs from 'fs';
import path from 'path';

import { isPremiumUiEnabledFor } from '@/utils/premium/premiumUiFlag';

const root = path.resolve(__dirname, '../../..');
const FLAG = 'EXPO_PUBLIC_HIDE_PREMIUM_UI';

describe('isPremiumUiEnabledFor', () => {
  it.each(['ios', 'android'])('is on for a native %s build unless hidden', (platform) => {
    expect(isPremiumUiEnabledFor({ platform, hide: undefined })).toBe(true);
    expect(isPremiumUiEnabledFor({ platform, hide: '0' })).toBe(true);
  });

  it.each(['ios', 'android'])(
    'is off for a native %s build with the kill switch set to 1',
    (platform) => {
      expect(isPremiumUiEnabledFor({ platform, hide: '1' })).toBe(false);
    }
  );

  it('is off on a production web build', () => {
    expect(isPremiumUiEnabledFor({ platform: 'web', hide: undefined })).toBe(false);
    expect(isPremiumUiEnabledFor({ platform: 'web', hide: undefined, dev: false })).toBe(false);
  });

  it('is on for web under the development server unless hidden', () => {
    expect(isPremiumUiEnabledFor({ platform: 'web', hide: undefined, dev: true })).toBe(true);
    expect(isPremiumUiEnabledFor({ platform: 'web', hide: '1', dev: true })).toBe(false);
  });

  it.each(['true', 'yes', ' 1', '', undefined])(
    'only the exact string "1" hides it (%p)',
    (hide) => {
      expect(isPremiumUiEnabledFor({ platform: 'ios', hide })).toBe(true);
    }
  );
});

describe('build configuration never sets the kill switch', () => {
  it.each(['eas.json', 'app.json', 'package.json'])('%s does not mention the flag', (file) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    expect(text).not.toContain(FLAG);
  });
});

describe('the flag is read in one place', () => {
  const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'android', 'ios', 'dist']);
  const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          sourceFiles(path.join(dir, entry.name), out);
        }
      } else if (EXTENSIONS.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
    return out;
  }

  it('is referenced only by utils/premium/premiumUiFlag.ts outside tests', () => {
    const owner = path.join(root, 'utils/premium/premiumUiFlag.ts');
    const readers = sourceFiles(root)
      .filter((file) => fs.readFileSync(file, 'utf8').includes(FLAG))
      .filter((file) => file !== __filename)
      .filter((file) => !/jest\.setup(\.jsdom)?\.js$/.test(file));

    expect(readers).toEqual([owner]);
  });
});
