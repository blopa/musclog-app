import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { AI_GATEWAY_LINKS } from '@/constants/aiGatewayLinks';

const ROOT = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

describe('AI gateway links', () => {
  it('lists exactly the four gateway policy and terms URLs', () => {
    expect(AI_GATEWAY_LINKS.map((link) => link.url)).toEqual([
      'https://openrouter.ai/privacy',
      'https://openrouter.ai/terms',
      'https://otari.ai/privacy',
      'https://otari.ai/terms',
    ]);
  });

  it.each([
    ['app/(website)/[locale]/privacy.web.tsx', 'AI_GATEWAY_LINKS'],
    ['app/(website)/[locale]/terms.web.tsx', 'AiGatewayLinks'],
    ['app/(website)/[locale]/premium.web.tsx', 'AiGatewayLinks'],
    ['components/modals/PremiumModal.tsx', 'AI_GATEWAY_LINKS'],
    ['components/website/AiGatewayLinks.tsx', 'AI_GATEWAY_LINKS'],
  ])('%s uses the shared list', (file, identifier) => {
    expect(read(file)).toContain(identifier);
  });

  it('no website page hard-codes a gateway privacy URL', () => {
    const offenders = sourceFiles(join(ROOT, 'app/(website)')).filter((file) =>
      readFileSync(file, 'utf8').includes('openrouter.ai/privacy')
    );

    expect(offenders).toEqual([]);
  });
});
