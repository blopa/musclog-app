import fs from 'fs';
import path from 'path';

import { isPremiumUiEnabledFor } from '@/utils/premium/premiumUiFlag';

const root = path.resolve(__dirname, '../../..');
const FLAG = 'EXPO_PUBLIC_PREMIUM_UI';

describe('isPremiumUiEnabledFor', () => {
  it.each(['ios', 'android'])('is on for a native %s build with the flag set to 1', (platform) => {
    expect(isPremiumUiEnabledFor({ platform, flag: '1' })).toBe(true);
  });

  it('is off on web even with the flag set', () => {
    expect(isPremiumUiEnabledFor({ platform: 'web', flag: '1' })).toBe(false);
  });

  it.each(['0', 'true', 'yes', ' 1', '', undefined])(
    'is off unless the flag is exactly "1" (%p)',
    (flag) => {
      expect(isPremiumUiEnabledFor({ platform: 'ios', flag })).toBe(false);
    }
  );
});

describe('build configuration never switches Premium UI on', () => {
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
      .filter((file) => file !== __filename);

    expect(readers).toEqual([owner]);
  });
});
