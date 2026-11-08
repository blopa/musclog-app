import websiteLoggyPoses from '@/components/website/websiteLoggyPoses.json';
import { LOGGY_CLASSIC, loggyColorsForTheme, loggyPaletteId } from '@/constants/loggyTheme';
import { THEME_IDS } from '@/theme.registry';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

/**
 * Where the website's Loggy files are and how a page picks the one for the visitor's theme. Pure
 * (no React Native, no settings), because `app/+html.tsx` builds the stylesheet from it in Node
 * during static export, and `WebsiteLoggy` and the tests read the same names.
 *
 * Loggy is an image a browser animates by itself, and an `<img>` cannot read the page's theme, so
 * each theme's greens are baked into its own copy of every pose
 * (`public/images/loggy/<palette>/loggy-<pose>.svg`, written by `scripts/sync-website-loggy.js`).
 * Which copy a `WebsiteLoggy` shows is decided in CSS from the `data-theme-id` attribute on
 * `<html>`, which the blocking script in `app/+html.tsx` sets before the body renders: a script
 * that swapped the image after hydration would show the default green for a moment, in exactly the
 * theme the visitor chose to get away from it.
 */

export type WebsiteLoggyPose = keyof typeof websiteLoggyPoses;

/**
 * The poses the website draws, each with its `viewBox` width and height. The file is written by
 * `scripts/sync-website-loggy.js` (which owns the set), so it cannot name a pose with no published
 * file. The size gives the element its aspect ratio, so the browser reserves the right box before
 * the file arrives, whatever size the caller's classes give it; `websiteLoggy.test.ts` reads it
 * back from the SVGs.
 */
export const WEBSITE_LOGGY_VIEWBOX: Record<WebsiteLoggyPose, { width: number; height: number }> =
  websiteLoggyPoses;

export const WEBSITE_LOGGY_POSES = Object.keys(websiteLoggyPoses) as WebsiteLoggyPose[];

/** The media query under which the still replaces the animation. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The class every Loggy element carries, and the one that names its pose. */
export const WEBSITE_LOGGY_CLASS = 'website-loggy';

export function websiteLoggyPoseClass(pose: WebsiteLoggyPose): string {
  return `${WEBSITE_LOGGY_CLASS}-${pose}`;
}

/**
 * The file for a pose in a theme's greens: the animated one, or with `still` the same drawing not
 * moving (the reduced-motion file). The files are filed under the first theme that is drawn in the
 * same greens (`loggyPaletteId`), so any theme id finds its own.
 */
export function websiteLoggySrc(
  pose: WebsiteLoggyPose,
  themeId: string,
  still = false,
  base?: string
): string {
  return withExpoBaseUrl(
    `/images/loggy/${loggyPaletteId(themeId)}/loggy-${pose}${still ? '-still' : ''}.svg`,
    base
  );
}

/** The inline style that reserves a pose's box. */
export function websiteLoggyBox(pose: WebsiteLoggyPose): { aspectRatio: string } {
  const { width, height } = WEBSITE_LOGGY_VIEWBOX[pose];

  return { aspectRatio: `${width} / ${height}` };
}

/** Theme ids grouped by the palette they are drawn in, each group named by its first theme. */
function themesByPalette(): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const themeId of THEME_IDS as readonly string[]) {
    const paletteId = loggyPaletteId(themeId);
    groups.set(paletteId, [...(groups.get(paletteId) ?? []), themeId]);
  }

  return groups;
}

function isClassic(themeId: string): boolean {
  const colors = loggyColorsForTheme(themeId);

  return (['body', 'shade', 'deep'] as const).every((role) => colors[role] === LOGGY_CLASSIC[role]);
}

/**
 * The stylesheet that shows each pose in the visitor's theme. The classic green is the default (it
 * is also what a visitor with no script gets), every other palette overrides it under the
 * `data-theme-id` of the themes that use it, and a visitor who asked for reduced motion gets the
 * still of each: the browser only ever fetches the image its rules select.
 *
 * An element, not an `<img>`: a background is what CSS can choose between, and Loggy is decorative.
 */
export function websiteLoggyCss(base?: string): string {
  const groups = [...themesByPalette()];
  const classic = groups.find(([paletteId]) => isClassic(paletteId))?.[0] ?? groups[0][0];
  const others = groups.filter(([paletteId]) => paletteId !== classic);

  const rules = (still: boolean) =>
    WEBSITE_LOGGY_POSES.flatMap((pose) => {
      const selector = `.${websiteLoggyPoseClass(pose)}`;
      const image = (themeId: string) => `url(${websiteLoggySrc(pose, themeId, still, base)})`;

      return [
        `${selector}{background-image:${image(classic)}}`,
        ...others.map(
          ([paletteId, themeIds]) =>
            `${themeIds.map((themeId) => `html[data-theme-id="${themeId}"] ${selector}`).join(',')}` +
            `{background-image:${image(paletteId)}}`
        ),
      ];
    });

  return [
    `.${WEBSITE_LOGGY_CLASS}{display:block;background-position:center;background-repeat:no-repeat;background-size:contain}`,
    ...rules(false),
    `@media ${REDUCED_MOTION_QUERY}{${rules(true).join('')}}`,
  ].join('\n');
}
