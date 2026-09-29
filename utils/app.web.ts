import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

export function isProduction() {
  return !__DEV__;
}

/**
 * Where a restore has to send the browser, or `null` to reload the current URL in place.
 *
 * On web `reloadApp()` is `window.location.reload()`, which re-requests whatever URL the tab is
 * on. A restore can be started from the onboarding landing screen (`app/app/onboarding/landing.tsx`
 * offers both file import and optical receive), and reloading that URL drops the user back into
 * onboarding on top of a fully restored, already-onboarded database. Native does not behave this
 * way: `DevSettings.reload()` / `reloadAppAsync()` restart at the app's entry route, which redirects
 * an onboarded user to `/app`.
 *
 * Calling `router.replace('/app')` first did not fix it — expo-router commits the
 * `history.replaceState` on a later tick, so the reload was still issued against the onboarding URL
 * while React had already rendered the dashboard. That is exactly what the report described: the
 * data imported, the dashboard appeared, then the tab reloaded into onboarding (see FIXES.md).
 *
 * Every other surface reloads in place on purpose. In particular the website progress page
 * (`app/(website)/progress.web.tsx`) imports a dump only to draw its own charts, so sending it to
 * `/app` would navigate a website visitor into the app.
 */
export function restoreReloadTarget(pathname: string): null | string {
  return /(^|\/)onboarding(\/|$)/.test(pathname) ? withExpoBaseUrl('/app') : null;
}

export async function reloadApp() {
  const target = restoreReloadTarget(window.location.pathname);

  if (target) {
    // `replace`, not `assign`: the onboarding screen the restore started from must not stay in
    // history for the back button to return to.
    window.location.replace(target);
    return;
  }

  window.location.reload();
}
