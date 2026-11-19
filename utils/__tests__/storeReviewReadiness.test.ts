import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const LOCALES = fs
  .readdirSync(path.join(root, 'lang/locales'))
  .filter((entry) => fs.statSync(path.join(root, 'lang/locales', entry)).isDirectory());

/** Every key path of a parsed locale file named `comingSoon` or whose English text says "coming soon". */
function comingSoonKeys(node: unknown, trail: string[] = []): string[] {
  if (typeof node === 'string') {
    return /coming soon/i.test(node) ? [trail.join('.')] : [];
  }

  if (node === null || typeof node !== 'object') {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) =>
    /comingSoon/i.test(key) ? [[...trail, key].join('.')] : comingSoonKeys(value, [...trail, key])
  );
}

/**
 * App Store guideline 2.3.1 asks for no future-functionality language in the app, and the age
 * rating answers describe what the app really does. The website (`website*.json`) may say its own
 * store badge is coming; the app's screens may not.
 */
describe('store review readiness', () => {
  it('has no "coming soon" copy in any app locale file', () => {
    const found: string[] = [];
    for (const locale of LOCALES) {
      const dir = path.join(root, 'lang/locales', locale);
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json') || file.startsWith('website')) {
          continue;
        }

        const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        found.push(...comingSoonKeys(parsed).map((key) => `${locale}/${file}: ${key}`));
      }
    }

    expect(found).toEqual([]);
  });

  it('does not claim age assurance or parental controls, which the app has neither of', () => {
    const rating = JSON.parse(
      fs.readFileSync(path.join(root, 'ios/appstore/metadata/age-rating.json'), 'utf8')
    );

    expect(rating.ageAssurance).toBe(false);
    expect(rating.parentalControls).toBe(false);
    // The coach is an AI chat with no other user on the other side.
    expect(rating.messagingAndChat).toBe(false);
    expect(rating.userGeneratedContent).toBe(false);
  });
});
