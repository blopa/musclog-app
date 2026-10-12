// The theme exposes 10%-opacity colours to JavaScript as tokens such as `accent.primary10`
// (`theme.tokens.js`), but the Tailwind palette only has the base colour. A class spelled
// `bg-accent-primary10` therefore compiles to NOTHING — no warning, no type error, just a
// transparent background. The weekly-review and workout-session screens shipped 30 of them
// (done set rows, guidance badges, the "ready" review card), as did several older modals.
// Tailwind's opacity modifier is the working spelling: `bg-accent-primary/10`.
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const BROKEN_ALPHA_CLASS = '(bg|text|border)-(accent|status)-[a-zA-Z]+[0-9]{2}\\b';

describe('Tailwind alpha colour classes', () => {
  it('uses the opacity modifier, never a JS-only alpha token name', () => {
    let matches = '';
    try {
      matches = execSync(
        `grep -rnE "${BROKEN_ALPHA_CLASS}" --include=*.tsx --include=*.ts app components hooks`,
        { cwd: ROOT, encoding: 'utf8' }
      );
    } catch {
      // grep exits 1 when nothing matches — the passing case.
    }
    expect(matches.trim()).toBe('');
  });
});
