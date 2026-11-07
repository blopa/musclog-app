import {
  WEBSITE_LOGGY_CLASS,
  websiteLoggyBox,
  type WebsiteLoggyPose,
  websiteLoggyPoseClass,
} from '@/components/website/websiteLoggyAssets';
import { useSettings } from '@/hooks/useSettings';

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
};

/**
 * Loggy on the public website: his animated SVG, in the greens of the visitor's theme. A browser
 * runs the keyframes inside the file, so there is no client code and the server HTML already
 * carries him.
 *
 * Which file he is drawn from is a stylesheet's decision, not this component's
 * (`websiteLoggyCss`, in `app/+html.tsx`): it picks the copy made for the theme on `<html>`, and
 * the still of it for a visitor who asked for reduced motion, so the browser never fetches the
 * animation for them. Choosing here, after hydration, would flash the default green first.
 *
 * Always decorative (a background, no alt text): the words beside him carry the meaning. The page
 * around him must not depend on him being there: when he is hidden nothing is rendered, so give
 * his margin and placement to the `className`. The element reserves his box from the SVG's own
 * proportions, so `h-36 w-auto` or `w-40 h-auto` both resolve the other side.
 */
export function WebsiteLoggy({ pose, className }: WebsiteLoggyProps) {
  const visible = useWebsiteLoggyVisible();

  if (!visible) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={[WEBSITE_LOGGY_CLASS, websiteLoggyPoseClass(pose), className]
        .filter(Boolean)
        .join(' ')}
      style={websiteLoggyBox(pose)}
    />
  );
}
