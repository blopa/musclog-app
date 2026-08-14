import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('EAS archive exclusions', () => {
  it('keeps generated and web-only inputs out of native uploads', () => {
    const patterns = new Set(
      fs
        .readFileSync(path.join(PROJECT_ROOT, '.easignore'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    );

    const requiredPatterns = [
      '.git',
      'android/.gradle',
      'android/.kotlin',
      'android/build',
      'android/app/.cxx',
      'android/app/build',
      '**/.gradle',
      '**/.cxx',
      '**/android/build',
      'public',
      'app/(website)/posts',
    ];

    for (const pattern of requiredPatterns) {
      expect(patterns).toContain(pattern);
    }
  });
});
