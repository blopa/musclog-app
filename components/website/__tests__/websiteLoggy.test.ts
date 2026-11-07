/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';

import {
  REDUCED_MOTION_QUERY,
  WEBSITE_LOGGY_POSES,
  WEBSITE_LOGGY_VIEWBOX,
  WebsiteLoggy,
  websiteLoggySrc,
} from '@/components/website/WebsiteLoggy';
import { useSettings } from '@/hooks/useSettings';

jest.mock('@/hooks/useSettings', () => ({ useSettings: jest.fn() }));

const { OUTPUT_DIR, SOURCE_DIR, WEBSITE_POSES, fileName, stillSvg } =
  require('../../../scripts/sync-website-loggy') as {
    OUTPUT_DIR: string;
    SOURCE_DIR: string;
    WEBSITE_POSES: string[];
    fileName: (pose: string, still?: boolean) => string;
    stillSvg: (animatedSvg: string) => string;
  };

function settings(overrides: { isLoading: boolean; showLoggy: boolean }) {
  jest.mocked(useSettings).mockReturnValue(overrides as ReturnType<typeof useSettings>);
}

describe('the Loggy files the website serves', () => {
  it('are the poses WebsiteLoggy can be asked for, and nothing else', () => {
    expect([...WEBSITE_LOGGY_POSES]).toEqual(WEBSITE_POSES);
    expect(readdirSync(OUTPUT_DIR).sort()).toEqual(
      WEBSITE_POSES.flatMap((pose) => [fileName(pose), fileName(pose, true)]).sort()
    );
  });

  it.each([...WEBSITE_LOGGY_POSES])(
    'copy %s is the generated animated SVG, not an edit of it',
    (pose) => {
      // A stale copy means the artwork changed and `npm run generate-loggy` was not run.
      expect(readFileSync(join(OUTPUT_DIR, fileName(pose)), 'utf8')).toBe(
        readFileSync(join(SOURCE_DIR, fileName(pose)), 'utf8')
      );
    }
  );

  it.each([...WEBSITE_LOGGY_POSES])(
    'still %s is the animated file with its animation switched off',
    (pose) => {
      const animated = readFileSync(join(SOURCE_DIR, fileName(pose)), 'utf8');
      const still = readFileSync(join(OUTPUT_DIR, fileName(pose, true)), 'utf8');

      expect(still).toBe(stillSvg(animated));
      expect(still).toMatch(/\* \{ animation: none !important; \}/);
      // The same drawing, so it is the same weight rather than the 200 KB generated still.
      expect(still.length - animated.length).toBeLessThan(100);
    }
  );

  it('refuses an SVG with no style block to hold the still rule', () => {
    expect(() => stillSvg('<svg></svg>')).toThrow(/no <style> block/);
  });

  it.each([...WEBSITE_LOGGY_POSES])('%s reserves the box its viewBox draws', (pose) => {
    const svg = readFileSync(join(OUTPUT_DIR, fileName(pose)), 'utf8');
    const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);

    expect(match).not.toBeNull();
    expect(WEBSITE_LOGGY_VIEWBOX[pose]).toEqual([Number(match?.[1]), Number(match?.[2])]);
  });

  it.each([...WEBSITE_LOGGY_POSES])(
    '%s stills itself under reduced motion and loads nothing else',
    (pose) => {
      // Opened on its own, the file stops its keyframes by its own media query; as an <img> it
      // never runs a script or fetches a second file.
      const svg = readFileSync(join(OUTPUT_DIR, fileName(pose)), 'utf8');

      expect(svg).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
      expect(svg).not.toMatch(/<script|<image\b|data:|href=/i);
    }
  );
});

describe('WebsiteLoggy', () => {
  it('is a decorative image with its box reserved, lazy unless asked otherwise', () => {
    settings({ isLoading: false, showLoggy: true });
    const { container, rerender } = render(
      createElement(WebsiteLoggy, { pose: 'wave', className: 'h-40 w-auto' })
    );

    const image = container.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('src')).toBe(websiteLoggySrc('wave'));
    expect(image?.getAttribute('src')).toBe('/images/loggy/loggy-wave.svg');
    expect(image?.getAttribute('width')).toBe('560');
    expect(image?.getAttribute('height')).toBe('640');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.className).toBe('h-40 w-auto');
    // The picture adds no box of its own, so a flex or grid parent lays the image out directly.
    expect(container.querySelector('picture')?.className).toBe('contents');

    rerender(createElement(WebsiteLoggy, { pose: 'wave', eager: true }));
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager');
  });

  it('serves the still, not the animation, to a visitor who asked for reduced motion', () => {
    settings({ isLoading: false, showLoggy: true });
    const { container } = render(createElement(WebsiteLoggy, { pose: 'lifting' }));

    // The browser picks the <source> before it fetches anything, so the animated file is never
    // downloaded for that visitor. Verified in Chrome: the still is served and does not move.
    const source = container.querySelector('picture > source');
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
    expect(source?.getAttribute('media')).toBe(REDUCED_MOTION_QUERY);
    expect(source?.getAttribute('srcset')).toBe('/images/loggy/loggy-lifting-still.svg');
    expect(source?.nextElementSibling?.tagName).toBe('IMG');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/images/loggy/loggy-lifting.svg'
    );
    expect(websiteLoggySrc('lifting', true)).toBe(source?.getAttribute('srcset'));
  });

  it('is drawn while settings load, which is what the static HTML holds', () => {
    settings({ isLoading: true, showLoggy: false });
    const { container } = render(createElement(WebsiteLoggy, { pose: 'thinking' }));

    expect(container.querySelector('img')).not.toBeNull();
  });

  it('leaves nothing behind once the visitor has turned Loggy off', () => {
    settings({ isLoading: false, showLoggy: false });
    const { container } = render(createElement(WebsiteLoggy, { pose: 'shrug' }));

    expect(container.innerHTML).toBe('');
  });
});
