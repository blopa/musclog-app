import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');

describe('navigation destination reachability', () => {
  it('puts enabled destinations missing from the bottom bar into the account menu', () => {
    const menu = read('components/modals/UserMenuModal.tsx');

    expect(menu).toContain("'cycle'");
    expect(menu).toContain('(item) => !isInNav(item) && isNavItemAvailable(item, isCycleActive)');
    expect(menu).toContain('NAV_DESTINATIONS[item]');
    expect(menu).toContain('isNavItemAvailable');
  });

  it('always offers onboarding tracking choices in settings, including before setup', () => {
    const settings = read('components/modals/CycleSettingsModal.tsx');
    expect(settings.indexOf('<CycleTrackingModeSettings')).toBeLessThan(
      settings.indexOf('{tracked ?')
    );
    expect(read('components/cycle/CycleTrackingModeSettings.tsx')).toContain(
      'CYCLE_TRACKING_CHOICES.map'
    );
    expect(read('app/app/onboarding/personalized-cycle.tsx')).toContain(
      'CYCLE_TRACKING_CHOICES.map'
    );
  });

  it('uses one availability rule for every navigation surface', () => {
    expect(read('components/modals/VisualSettingsModal.tsx')).toContain(
      'NAV_ITEM_KEYS.filter((item) => isNavItemAvailable(item, isCycleActive))'
    );

    for (const file of [
      'components/modals/VisualSettingsModal.tsx',
      'components/NavigationMenu.tsx',
      'hooks/useNavigationItems.ts',
    ]) {
      expect(read(file)).toContain('isNavItemAvailable');
    }
  });
});
