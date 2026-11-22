import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, '../../lang/lang.ts'), 'utf8');

describe('lang/lang.ts defaults', () => {
  it('falls back to DEFAULT_LANG, never to whichever locale folder sorts first', () => {
    expect(source).toContain('fallbackLng: DEFAULT_LANG,');
    expect(source).toContain('?.languageTag || DEFAULT_LANG,');
    expect(source).toContain('export const DEFAULT_LANG = EN_US;');
  });

  it('the generator writes the same defaults', () => {
    const generator = fs.readFileSync(path.join(__dirname, '../generateLangFile.js'), 'utf8');
    expect(generator).toContain('fallbackLng: DEFAULT_LANG,');
    expect(generator).toContain('?.languageTag || DEFAULT_LANG,');
  });
});
