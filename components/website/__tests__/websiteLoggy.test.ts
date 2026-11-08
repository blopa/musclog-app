/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';

import { WebsiteLoggy } from '@/components/website/WebsiteLoggy';
import {
  REDUCED_MOTION_QUERY,
  WEBSITE_LOGGY_CLASS,
  WEBSITE_LOGGY_POSES,
  WEBSITE_LOGGY_VIEWBOX,
  websiteLoggyBox,
  websiteLoggyCss,
  websiteLoggyPoseClass,
  websiteLoggySrc,
} from '@/components/website/websiteLoggyAssets';
import { useSettings } from '@/hooks/useSettings';
import { THEME_IDS } from '@/theme.registry';

jest.mock('@/hooks/useSettings', () => ({ useSettings: jest.fn() }));

const { LOGGY_CLASSIC, loggyColorsForTheme, loggyPaletteId } =
  require('../../../constants/loggyTheme') as {
    LOGGY_CLASSIC: Record<string, string>;
    loggyColorsForTheme: (themeId: string) => Record<string, string>;
    loggyPaletteId: (themeId: string) => string;
  };

const {
  OUTPUT_DIR,
  PALETTE_IDS,
  POSES_FILE,
  SOURCE_DIR,
  WEBSITE_POSES,
  fileName,
  generateAll,
  generatePoses,
  listPublished,
  stillSvg,
} = require('../../../scripts/sync-website-loggy') as {
  OUTPUT_DIR: string;
  PALETTE_IDS: string[];
  POSES_FILE: string;
  SOURCE_DIR: string;
  WEBSITE_POSES: string[];
  fileName: (pose: string, still?: boolean) => string;
  generateAll: () => Record<string, string>;
  generatePoses: () => string;
  listPublished: (directory: string) => string[];
  stillSvg: (animatedSvg: string) => string;
};

function settings(overrides: { isLoading: boolean; showLoggy: boolean }) {
  jest.mocked(useSettings).mockReturnValue(overrides as ReturnType<typeof useSettings>);
}

const published = generateAll();

describe('the Loggy files the website serves', () => {
  it('are the poses WebsiteLoggy can be asked for, in each theme palette, and nothing else', () => {
    expect([...WEBSITE_LOGGY_POSES]).toEqual(WEBSITE_POSES);
    expect(listPublished(OUTPUT_DIR)).toEqual(Object.keys(published).sort());
    expect(Object.keys(published)).toHaveLength(WEBSITE_POSES.length * PALETTE_IDS.length * 2);
  });

  it('keep one directory per distinct palette: themes drawn alike share their files', () => {
    expect(new Set(THEME_IDS.map(loggyPaletteId))).toEqual(new Set(PALETTE_IDS));
    expect(loggyPaletteId('kinetic-light')).toBe(loggyPaletteId('kinetic-depth'));
    expect(PALETTE_IDS.length).toBeLessThan(THEME_IDS.length);
  });

  // A stale copy means the artwork or a theme's greens changed and `npm run generate-loggy` was
  // not run.
  it.each(Object.keys(published))('%s is what the generator writes', (relative) => {
    expect(readFileSync(join(OUTPUT_DIR, relative), 'utf8')).toBe(published[relative]);
  });

  it.each(PALETTE_IDS)('%s is the animated artwork in that palette’s greens', (paletteId) => {
    const colors = loggyColorsForTheme(paletteId);

    for (const pose of WEBSITE_POSES) {
      const svg = published[`${paletteId}/${fileName(pose)}`];

      expect(svg).toContain(`.s1 { fill: ${colors.body} }`);
      expect(svg).toContain(`.s3 { fill: ${colors.deep} }`);
      expect(svg).not.toContain('var(--loggy');
    }
  });

  it('turn the log a different colour in every palette but the first', () => {
    const [classic, ...rest] = PALETTE_IDS;

    expect(loggyColorsForTheme(classic)).toBe(LOGGY_CLASSIC);

    for (const paletteId of rest) {
      expect(published[`${paletteId}/${fileName('wave')}`]).not.toBe(
        published[`${classic}/${fileName('wave')}`]
      );
    }
  });

  it.each([...WEBSITE_LOGGY_POSES])(
    'still %s is the animated file with its animation switched off',
    (pose) => {
      for (const paletteId of PALETTE_IDS) {
        const animated = published[`${paletteId}/${fileName(pose)}`];
        const still = published[`${paletteId}/${fileName(pose, true)}`];

        expect(still).toBe(stillSvg(animated));
        expect(still).toMatch(/\* \{ animation: none !important; \}/);
        // The same drawing, so it is the same weight rather than the 200 KB generated still.
        expect(still.length - animated.length).toBeLessThan(100);
      }
    }
  );

  it('list their poses and sizes in the generated file the page reads', () => {
    expect(readFileSync(POSES_FILE, 'utf8')).toBe(generatePoses());
  });

  it('refuses an SVG with no style block to hold the still rule', () => {
    expect(() => stillSvg('<svg></svg>')).toThrow(/no <style> block/);
  });

  it.each([...WEBSITE_LOGGY_POSES])('%s reserves the box its viewBox draws', (pose) => {
    const svg = readFileSync(join(SOURCE_DIR, fileName(pose)), 'utf8');
    const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);

    expect(match).not.toBeNull();
    expect(WEBSITE_LOGGY_VIEWBOX[pose]).toEqual({
      width: Number(match?.[1]),
      height: Number(match?.[2]),
    });
  });

  it.each([...WEBSITE_LOGGY_POSES])(
    '%s stills itself under reduced motion and loads nothing else',
    (pose) => {
      // Opened on its own, the file stops its keyframes by its own media query; shown as a CSS
      // background it never runs a script or fetches a second file.
      for (const paletteId of PALETTE_IDS) {
        const svg = published[`${paletteId}/${fileName(pose)}`];

        expect(svg).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
        expect(svg).not.toMatch(/<script|<image\b|data:|href=/i);
      }
    }
  );
});

describe('websiteLoggySrc', () => {
  it('names a theme’s file under its palette directory, animated or still', () => {
    expect(websiteLoggySrc('wave', 'kinetic-depth')).toBe(
      '/images/loggy/kinetic-depth/loggy-wave.svg'
    );
    expect(websiteLoggySrc('wave', 'kinetic-light')).toBe(
      '/images/loggy/kinetic-depth/loggy-wave.svg'
    );
    expect(websiteLoggySrc('wave', 'kinetic-shock', true)).toBe(
      '/images/loggy/kinetic-shock/loggy-wave-still.svg'
    );
  });

  it('follows the base URL the site is exported under', () => {
    expect(websiteLoggySrc('wave', 'kinetic-volt', false, '/musclog-app')).toBe(
      '/musclog-app/images/loggy/kinetic-volt/loggy-wave.svg'
    );
  });

  it.each(Object.keys(published))('%s exists where the stylesheet will look for it', (relative) => {
    expect(existsSync(join(OUTPUT_DIR, relative))).toBe(true);
  });
});

describe('websiteLoggyCss', () => {
  const css = websiteLoggyCss();
  const [animatedRules, reducedMotionBlock] = css.split(`@media ${REDUCED_MOTION_QUERY}`);

  it('draws every pose in the default green when the theme is unknown or is the default', () => {
    for (const pose of WEBSITE_LOGGY_POSES) {
      expect(animatedRules).toContain(
        `.${websiteLoggyPoseClass(pose)}{background-image:url(${websiteLoggySrc(pose, 'kinetic-depth')})}`
      );
    }
  });

  it('overrides it under the data-theme-id of every theme that has its own greens', () => {
    for (const themeId of THEME_IDS) {
      const own = loggyColorsForTheme(themeId) !== LOGGY_CLASSIC;

      for (const pose of WEBSITE_LOGGY_POSES) {
        const rule = `html[data-theme-id="${themeId}"] .${websiteLoggyPoseClass(pose)}`;
        const url = `url(${websiteLoggySrc(pose, themeId)})`;

        expect(animatedRules.includes(rule)).toBe(own);

        if (own) {
          expect(animatedRules).toMatch(
            new RegExp(
              `${rule.replace(/[[\]".]/g, '\\$&')}[^}]*\\{background-image:${url.replace(/[().]/g, '\\$&')}\\}`
            )
          );
        }
      }
    }
  });

  // The base rule loses to a themed rule outside the media block on specificity, so the still must
  // be repeated per theme there, or a visitor with a custom theme and reduced motion would get the
  // animation.
  it('serves the still of every pose and theme under reduced motion', () => {
    expect(css).toContain(`@media ${REDUCED_MOTION_QUERY}{`);

    for (const themeId of THEME_IDS) {
      for (const pose of WEBSITE_LOGGY_POSES) {
        expect(reducedMotionBlock).toContain(`url(${websiteLoggySrc(pose, themeId, true)})`);
      }
    }

    expect(reducedMotionBlock).not.toMatch(/loggy-\w+\.svg\)/);
  });

  it('draws the image as a contained, centred background', () => {
    expect(css).toContain(
      `.${WEBSITE_LOGGY_CLASS}{display:block;background-position:center;background-repeat:no-repeat;background-size:contain}`
    );
  });

  it('uses the base URL for every file', () => {
    expect(websiteLoggyCss('/musclog-app')).not.toContain('url(/images');
    expect(websiteLoggyCss('/musclog-app')).toContain('url(/musclog-app/images/loggy/');
  });
});

describe('WebsiteLoggy', () => {
  it('is a decorative element with its box reserved from the SVG’s proportions', () => {
    settings({ isLoading: false, showLoggy: true });
    const { container } = render(
      createElement(WebsiteLoggy, { pose: 'wave', className: 'h-40 w-auto' })
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.className).toBe(
      `${WEBSITE_LOGGY_CLASS} ${websiteLoggyPoseClass('wave')} h-40 w-auto`
    );
    expect(element.style.aspectRatio).toBe('560 / 640');
    expect(websiteLoggyBox('wave')).toEqual({ aspectRatio: '560 / 640' });
    // It names no file: the stylesheet picks the one for the theme and for reduced motion.
    expect(container.querySelector('img, picture, source')).toBeNull();
    expect(container.innerHTML).not.toMatch(/\.svg|src=/);
  });

  it('is drawn while settings load, which is what the static HTML holds', () => {
    settings({ isLoading: true, showLoggy: false });
    const { container } = render(createElement(WebsiteLoggy, { pose: 'thinking' }));

    expect(container.firstElementChild?.className).toContain(websiteLoggyPoseClass('thinking'));
  });

  it('leaves nothing behind once the visitor has turned Loggy off', () => {
    settings({ isLoading: false, showLoggy: false });
    const { container } = render(createElement(WebsiteLoggy, { pose: 'shrug' }));

    expect(container.innerHTML).toBe('');
  });
});
