import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The scanner is CommonJS because npm invokes it directly under Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TranslationScanner = require('../check-translations');

let fixtureDir: string;

beforeEach(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'musclog-translations-test-'));
});

afterEach(() => {
  rmSync(fixtureDir, { force: true, recursive: true });
});

function scan(source: string, existingKeys: string[]): Set<string> {
  const filePath = join(fixtureDir, 'fixture.tsx');
  writeFileSync(filePath, source);
  const scanner = new TranslationScanner();
  scanner.existingKeys = new Set(existingKeys);
  return scanner.extractKeysFromFile(filePath);
}

it('resolves useTranslation key prefixes within each component scope', () => {
  const keys = scan(
    `
      function Card() {
        const { i18n, t } = useTranslation(undefined, { keyPrefix: 'website.card' });
        return <h2>{t('title')}</h2>;
      }
      function Footer() {
        const { t: footerT } = useTranslation(undefined, { keyPrefix: 'website.footer' });
        return <span>{footerT('copyright')}</span>;
      }
    `,
    ['website.card.title', 'website.footer.copyright']
  );

  expect(keys).toEqual(new Set(['website.card.title', 'website.footer.copyright']));
});

it('ignores unrelated strings while retaining direct, dynamic, and configured translation keys', () => {
  const keys = scan(
    `
      function Screen({ kind }) {
        const { t } = useTranslation();
        const style = { boxShadow: '0 0 14px rgba(0,255,163,0.8)' };
        const variant = kind ? 'primary' : 'default';
        return <Thing title={t('profile.title')} label={t(\`profile.kind.\${kind}\`)} />;
      }
      const item = { titleKey: 'settings.title' };
    `,
    ['profile.title', 'profile.kind.one', 'settings.title']
  );

  expect(keys).toEqual(new Set(['profile.title', 'profile.kind', 'settings.title']));
});

it('treats i18next plural variants as satisfying and using their base key', () => {
  const scanner = new TranslationScanner();
  scanner.existingKeys = new Set(['items.count_one', 'items.count_other']);
  scanner.usedKeys = new Set(['items.count']);

  scanner.findMissingTranslations();

  expect(scanner.missingKeys.size).toBe(0);
  expect(scanner.usedKeys).toEqual(
    new Set(['items.count', 'items.count_one', 'items.count_other'])
  );
});
