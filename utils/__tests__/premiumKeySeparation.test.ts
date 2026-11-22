import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// The Premium OpenRouter key lives only in the Worker (a `wrangler secret`). The app bundle ships
// the free-tier key alone (`EXPO_PUBLIC_MUSCLOG_GATEWAY_AUTH_TOKEN`), which is public by design.
const ROOT = join(__dirname, '..', '..');
const APP_DIRS = [
  'app',
  'components',
  'constants',
  'context',
  'database',
  'hooks',
  'services',
  'utils',
  'widgets',
];
const SKIPPED = new Set(['node_modules', '__tests__', 'premium-worker']);
const FORBIDDEN = /OPENROUTER_API_KEY|EXPO_PUBLIC_\w*OPENROUTER/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIPPED.has(name)) {
      return [];
    }

    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }

    return /\.(tsx?|jsx?|json)$/.test(name) ? [path] : [];
  });
}

describe('Premium key separation', () => {
  it('names the Premium OpenRouter key nowhere in client code', () => {
    const offenders = APP_DIRS.flatMap((d) => sources(join(ROOT, d))).filter((f) =>
      FORBIDDEN.test(readFileSync(f, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });

  it('puts no OpenRouter key in the build config or env template', () => {
    for (const file of ['app.json', 'eas.json', '.env.example']) {
      expect(readFileSync(join(ROOT, file), 'utf8')).not.toMatch(FORBIDDEN);
    }
  });
});
