import { useSettings } from '@/hooks/useSettings';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

/**
 * The poses the website draws: one file each in `public/images/loggy/`, published from
 * `assets/avatars/loggy-animated` by `scripts/sync-website-loggy.js` (`npm run generate-loggy`).
 * `websiteLoggy.test.ts` holds this list equal to the script's.
 */
export const WEBSITE_LOGGY_POSES = ['lifting', 'reading', 'shrug', 'thinking', 'wave'] as const;

export type WebsiteLoggyPose = (typeof WEBSITE_LOGGY_POSES)[number];

/**
 * Each SVG's `viewBox` width and height. They go on the `<img>` as `width`/`height` so the browser
 * reserves the right box before the file arrives, whatever size the caller's classes give it;
 * `websiteLoggy.test.ts` reads them back from the files.
 */
export const WEBSITE_LOGGY_VIEWBOX: Record<WebsiteLoggyPose, readonly [number, number]> = {
  lifting: [640, 640],
  reading: [512, 640],
  shrug: [560, 640],
  thinking: [512, 668],
  wave: [560, 640],
};

/** The animated file, or with `still` the same drawing not moving (the reduced-motion source). */
export function websiteLoggySrc(pose: WebsiteLoggyPose, still = false): string {
  return withExpoBaseUrl(`/images/loggy/loggy-${pose}${still ? '-still' : ''}.svg`);
}

/** The media query under which the still replaces the animation. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor wants Loggy at all (the app's "Show Loggy" setting; the web demo shares the
 * browser's storage with the website). While settings are still loading he is drawn, which is also
 * what the static HTML contains, so hydration matches. `WebsiteLoggy` already renders nothing when
 * this is false; a caller reads it only when he stands in for something else (the exercise list's
 * "no results" falls back to its icon).
 */
export function useWebsiteLoggyVisible(): boolean {
  const { isLoading, showLoggy } = useSettings();

  return isLoading || showLoggy;
}

type WebsiteLoggyProps = {
  pose: WebsiteLoggyPose;
  /** Sizing and placement only (`h-36 w-auto`): give a height or a width, the ratio follows. */
  className?: string;
  /** Skips lazy loading for a Loggy that is on screen when the page opens. */
  eager?: boolean;
};

/**
 * Loggy on the public website: his animated SVG as a plain image. A browser runs the keyframes
 * inside the file, so there is no client code and the server HTML already carries him.
 *
 * A visitor who asked for reduced motion gets the still instead: the `<source>` below is chosen by
 * the browser before it fetches anything, so the animated file is never downloaded for them. The
 * still is the same file with its animation switched off (`scripts/sync-website-loggy.js`), and
 * the animated one also stills itself under the same media query, in case the image is opened on
 * its own.
 *
 * Always decorative (`alt=""`): the words beside him carry the meaning. The page around him must
 * not depend on him being there: when he is hidden nothing is rendered, so give his margin and
 * placement to the `className` (it lands on the image, and `<picture>` is `display: contents`, so
 * a flex or grid parent lays the image out directly).
 */
export function WebsiteLoggy({ pose, className, eager = false }: WebsiteLoggyProps) {
  const visible = useWebsiteLoggyVisible();
  const [width, height] = WEBSITE_LOGGY_VIEWBOX[pose];

  if (!visible) {
    return null;
  }

  return (
    <picture className="contents">
      <source media={REDUCED_MOTION_QUERY} srcSet={websiteLoggySrc(pose, true)} />
      <img
        src={websiteLoggySrc(pose)}
        alt=""
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
