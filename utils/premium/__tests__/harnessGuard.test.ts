import fs from 'fs';
import path from 'path';

import {
  HARNESS_ROUTE_SEGMENT,
  isHarnessRouteAllowed,
  isPremiumHarnessBuild,
} from '@/utils/premium/harnessGuard';

const root = path.resolve(__dirname, '../../..');
const readRoot = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('isPremiumHarnessBuild', () => {
  it.each(['ios', 'android'])('is on for a native %s build with the flag set to 1', (platform) => {
    expect(isPremiumHarnessBuild({ platform, flag: '1' })).toBe(true);
  });

  it('is off on web even with the flag set', () => {
    expect(isPremiumHarnessBuild({ platform: 'web', flag: '1' })).toBe(false);
  });

  it.each(['0', 'true', '', undefined])('is off unless the flag is exactly "1" (%p)', (flag) => {
    expect(isPremiumHarnessBuild({ platform: 'ios', flag })).toBe(false);
  });
});

describe('isHarnessRouteAllowed', () => {
  it('allows the harness segment on a native build with the flag', () => {
    expect(
      isHarnessRouteAllowed({ lastSegment: HARNESS_ROUTE_SEGMENT, platform: 'android', flag: '1' })
    ).toBe(true);
  });

  it('refuses a different test segment even with the flag on', () => {
    expect(isHarnessRouteAllowed({ lastSegment: 'debug', platform: 'ios', flag: '1' })).toBe(false);
  });

  it('refuses the harness segment on web or without the flag', () => {
    expect(
      isHarnessRouteAllowed({ lastSegment: HARNESS_ROUTE_SEGMENT, platform: 'web', flag: '1' })
    ).toBe(false);
    expect(
      isHarnessRouteAllowed({
        lastSegment: HARNESS_ROUTE_SEGMENT,
        platform: 'ios',
        flag: undefined,
      })
    ).toBe(false);
  });

  it('refuses when there is no segment', () => {
    expect(isHarnessRouteAllowed({ lastSegment: undefined, platform: 'ios', flag: '1' })).toBe(
      false
    );
  });
});

describe('app/app/test/_layout.tsx guard', () => {
  const source = readRoot('app/app/test/_layout.tsx');

  it('imports the harness guard', () => {
    expect(source).toContain(
      "import { isHarnessRouteAllowed } from '@/utils/premium/harnessGuard';"
    );
  });

  it('keeps the production redirect and the unchanged screenshot fixture expression', () => {
    expect(source).toContain('isProduction()');
    expect(source).toContain(
      "const isScreenshotFixture =\n    Platform.OS === 'web' &&\n    process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1' &&\n    segments.at(-1) === 'modals';"
    );
    expect(source).toContain(
      'if (isProduction() && !isScreenshotFixture && !isAiChoiceFixture && !isPremiumHarness) {'
    );
  });

  it('lets the AI-choice fixture past only on web in screenshot mode', () => {
    expect(source).toContain(
      "const isAiChoiceFixture =\n    Platform.OS === 'web' &&\n    process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1' &&\n    segments.at(-1) === 'ai-choice';"
    );
  });
});

describe('eas.json premium-harness profile', () => {
  const eas = JSON.parse(readRoot('eas.json'));
  const profiles: Record<string, { extends?: string; env?: Record<string, string> }> = eas.build;

  // EAS merges `env` down the `extends` chain; the child's own values win.
  const effectiveEnv = (name: string): Record<string, string> => {
    const profile = profiles[name];
    const parent = profile.extends ? effectiveEnv(profile.extends) : {};
    return { ...parent, ...(profile.env ?? {}) };
  };

  it('sets the harness flag to 1 in premium-harness', () => {
    expect(effectiveEnv('premium-harness').EXPO_PUBLIC_PREMIUM_HARNESS).toBe('1');
  });

  it.each(['base', 'development', 'development:device', 'preview', 'production', 'production-apk'])(
    'does not set the harness flag in %s',
    (name) => {
      expect(effectiveEnv(name).EXPO_PUBLIC_PREMIUM_HARNESS).toBeUndefined();
    }
  );

  it('extends production', () => {
    expect(profiles['premium-harness'].extends).toBe('production');
  });

  it('is not referenced by package.json or app.json', () => {
    expect(readRoot('package.json')).not.toContain('EXPO_PUBLIC_PREMIUM_HARNESS');
    expect(readRoot('app.json')).not.toContain('EXPO_PUBLIC_PREMIUM_HARNESS');
  });
});

describe('release scripts keep a premium-harness build off production', () => {
  const android = readRoot('scripts/release-android.sh');
  const ios = readRoot('scripts/release-ios.sh');

  it('refuses a bundle passed by path on the production track', () => {
    expect(android).toMatch(/"\$track" == "production" && -n "\$aab"/);
  });

  it('needs an explicit confirmation to promote to production or submit for review', () => {
    expect(android).toMatch(/"\$to" == "production" && "\$not_harness" -eq 0/);
    expect(ios).toMatch(/"\$not_harness" -eq 1/);
  });
});
