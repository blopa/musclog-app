import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..', '..');

describe('onboarding optical import entry point', () => {
  it('opens the shared receiver in database-only mode', () => {
    const landingSource = readFileSync(
      join(repositoryRoot, 'app', 'app', 'onboarding', 'landing.tsx'),
      'utf8'
    );

    expect(landingSource).toContain('setOpticalImportVisible(true)');
    expect(landingSource).toMatch(/<OpticalReceiveModal\s+accept="database"/);
  });
});
