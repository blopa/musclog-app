import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Ratchets for the de-slop plan (`doc/redesign/DESLOP_PLAN.md`). Like `themeControls.test.ts`
 * these read source, because the rules are about what the components declare. A ceiling can only
 * go DOWN: lower it in the same change that removes the last offender, never raise it to make a
 * regression pass.
 */
const root = join(__dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (
      rel === 'components/website' ||
      rel === 'app/(website)' ||
      rel === 'app/app/test' ||
      name === '__tests__' ||
      name === 'node_modules'
    ) {
      continue;
    }

    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }

  return out;
}

const appFiles = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'components'))];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every file in the app and components whose code matches `pattern`, with the match count. */
function occurrences(pattern: RegExp): { file: string; count: number }[] {
  const hits: { file: string; count: number }[] = [];
  for (const file of appFiles) {
    const count = stripComments(readFileSync(file, 'utf8')).match(pattern)?.length ?? 0;
    if (count > 0) {
      hits.push({ file: relative(root, file).replace(/\\/g, '/'), count });
    }
  }

  return hits;
}

/** Measured when Phase 1 shipped (was 79 before three Home prompts and one empty state were demoted). */
const GRADIENT_CTA_CEILING = 73;

const total = (hits: { count: number }[]) => hits.reduce((sum, hit) => sum + hit.count, 0);

describe('Phase 1: buttons and shape', () => {
  it('has no colored glow shadows', () => {
    expect(occurrences(/shadows\.(accentGlow|accentGlowLarge|roseGlow)\b/)).toEqual([]);
  });

  it('does not define the glow shadows in the theme either', () => {
    const theme = readFileSync(join(root, 'theme.ts'), 'utf8');
    expect(theme).not.toMatch(/\b(accentGlow|accentGlowLarge|roseGlow)\b/);
  });

  it.each(['components/theme/Button.tsx', 'components/theme/Button.web.tsx'])(
    '%s sets no letter-spacing on its label',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/\btracking-/);
      expect(source).not.toMatch(/letterSpacing\s*:\s*['"]/);
    }
  );

  it.each(['components/theme/Button.tsx', 'components/theme/Button.web.tsx'])(
    '%s fills `accent` solid and keeps the gradient for gradientCta',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/gradients\.accent\b/);
      expect(source).not.toMatch(/borderRadius\[['"]2xl['"]\]|borderRadius\.xl\b/);
    }
  );

  it('keeps rounded-3xl from spreading (target 0)', () => {
    expect(total(occurrences(/\brounded-3xl\b/))).toBeLessThanOrEqual(6);
  });

  it('keeps gradientCta, the one primary action per screen, from spreading', () => {
    expect(total(occurrences(/gradientCta/))).toBeLessThanOrEqual(GRADIENT_CTA_CEILING);
  });

  it('draws ActionButton on the 16px card radius', () => {
    const source = stripComments(readFileSync(join(root, 'components/ActionButton.tsx'), 'utf8'));
    expect(source).not.toMatch(/\brounded-3xl\b/);
  });
});
