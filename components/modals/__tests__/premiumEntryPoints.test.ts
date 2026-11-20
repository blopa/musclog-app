// Source-level guards for the Premium entry points. The node Jest project does not render .tsx
// components, so these read the files and pin the gating the brief requires: nothing Premium shows
// unless usePremium().enabled, and the recovery actions open the Premium modal.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const NOT_CONFIGURED = read('components/modals/AINotConfiguredModal.tsx');
const SETTINGS = read('components/modals/AISettingsModal.tsx');
const PROVIDER = read('app/app/onboarding/ai-provider.tsx');
const CHAT = read('app/app/onboarding/ai-chat.tsx');

describe('AINotConfiguredModal Premium row', () => {
  it('reads usePremium and gates the Premium button on enabled', () => {
    expect(NOT_CONFIGURED).toContain("import { usePremium } from '@/hooks/usePremium'");
    expect(NOT_CONFIGURED).toContain('const premium = usePremium();');
    expect(NOT_CONFIGURED).toMatch(
      /const premiumButton = premium\.enabled \? \([\s\S]*?ai\.notConfiguredModal\.premium[\s\S]*?\) : null;/
    );
  });

  it('places the Premium button above the open-settings action and opens PremiumModal as a child', () => {
    const premiumIndex = NOT_CONFIGURED.indexOf('{premiumButton}\n      {settingsFooter}');
    // The rendered footer stacks the Premium button above the settings footer it wraps.
    expect(premiumIndex).toBeGreaterThan(-1);
    expect(NOT_CONFIGURED).toContain("'ai.notConfiguredModal.openSettings'");
    expect(NOT_CONFIGURED).toContain('<PremiumModal visible={premiumVisible}');
    expect(NOT_CONFIGURED).toContain('useSubModalVisibility(visible)');
  });

  it('keeps the original footer when Premium is disabled', () => {
    expect(NOT_CONFIGURED).toContain('label={t(\'common.close\')} variant="accent"');
  });
});

describe('AISettingsModal Premium entry', () => {
  it('puts PremiumCard above the free tier section', () => {
    const card = SETTINGS.indexOf('<PremiumCard onPress={() => setPremiumVisible(true)} />');
    const freeTier = SETTINGS.indexOf('Musclog Free Tier Section');
    expect(card).toBeGreaterThan(-1);
    expect(card).toBeLessThan(freeTier);
  });

  it('shows the active note only when Premium is on, active and the hosted switch is on', () => {
    expect(SETTINGS).toMatch(
      /premium\.enabled &&\s*premium\.view\.phase === 'active' &&\s*premium\.useHostedAi \?/
    );
    expect(SETTINGS).toContain("t('settings.aiSettings.premium.activeNote')");
  });

  it('renders PremiumModal inside the modal tree', () => {
    expect(SETTINGS).toContain('<PremiumModal visible={premiumVisible}');
  });
});

describe('ai-provider Premium option', () => {
  it('lists Premium only when enabled and never selects a provider for it', () => {
    expect(PROVIDER).toMatch(
      /\{premium\.enabled \? \(\s*<ListRow[\s\S]*?aiOnboarding\.provider\.premiumTitle[\s\S]*?setPremiumVisible\(true\)[\s\S]*?\) : null\}/
    );
    const premiumBlock = PROVIDER.slice(
      PROVIDER.indexOf('premium.enabled ? ('),
      PROVIDER.indexOf('aiOnboarding.provider.premiumTitle')
    );
    expect(premiumBlock).not.toContain('choose(');
    expect(premiumBlock).not.toContain('skipMusclogApi');
  });

  it('opens PremiumModal and leaves the save path unchanged', () => {
    expect(PROVIDER).toContain('<PremiumModal visible={premiumVisible}');
    expect(PROVIDER).toContain('const premium = usePremium();');
  });
});

describe('AI-setup chat recovery actions', () => {
  it('handles renewPremium and restorePremium by opening PremiumModal', () => {
    expect(CHAT).toMatch(
      /case 'renewPremium':\s*case 'restorePremium':\s*setPremiumVisible\(true\);/
    );
    expect(CHAT).toContain('<PremiumModal visible={premiumVisible}');
  });
});
