import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WebsiteLoggy } from '@/components/website/WebsiteLoggy';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { buildOpenSchemeUrl, type OpenLink, parseOpenFragment } from '@/utils/openLink';

/**
 * The bridge for `https://musclog.app/open#<kind>=<payload>`. With the app installed the OS opens
 * the app instead of this page; this page is what shows when it does not (no app, an in-app
 * browser, a link tapped from another musclog.app page). Its button is the custom-scheme twin of
 * the link, because a tap is what lets a browser launch the app.
 *
 * The payload lives in the fragment, which is never sent to the server. It is read once and then
 * removed from the address bar, so the analytics script (which reads the page URL) never sees it.
 */
export default function Open() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.open' });
  const [link, setLink] = useState<OpenLink | null>(null);

  useEffect(() => {
    const parsed = parseOpenFragment(window.location.hash);
    // Only a link with a payload replaces the state: React's dev double effect would otherwise
    // wipe it with the (by then removed) empty fragment.
    if (!parsed) {
      return;
    }

    // Through a named helper rather than a bare setState in the effect body:
    // `react-hooks/set-state-in-effect` is an error in this repo (same idiom as `workouts.tsx`).
    const showLink = () => setLink(parsed);
    showLink();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-xl flex-col justify-center px-4 py-20">
      <WebsiteLoggy pose="reading" eager className="mb-6 h-28 w-auto self-start sm:h-32" />
      <h1 className="text-balance text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
        {t('title')}
      </h1>
      <p className="mt-4 text-balance text-base leading-7 text-text-secondary sm:text-lg">
        {link === null
          ? t('descriptionEmpty')
          : t(link.kind === 'workout' ? 'descriptionWorkout' : 'descriptionFood')}
      </p>

      {link === null ? null : (
        <a
          href={buildOpenSchemeUrl(link)}
          className="mt-8 inline-flex w-fit items-center justify-center rounded-control bg-accent-bright px-6 py-3 text-base font-bold text-text-on-accent focus:outline-none focus:ring-2 focus:ring-accent-bright focus:ring-offset-2 focus:ring-offset-bg-primary"
        >
          {t('openButton')}
        </a>
      )}

      <p className="mt-10 text-sm leading-6 text-text-secondary">
        {t('installHint')}{' '}
        <a href="/download" className="font-semibold text-text-primary underline">
          {t('installLink')}
        </a>
      </p>
    </main>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('open');
}
