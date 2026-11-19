import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { legacyForwardPath } from './localeRoutes';
import { WebsiteLoggy } from './WebsiteLoggy';
import { WebsiteShell } from './WebsiteShell';

/**
 * The page behind an old, unprefixed address (`/tools/protein-calculator`, `/`): it forwards the
 * browser to the same page in English (`/en/tools/protein-calculator`). The site is static files, so
 * this is the browser's job. It sits in the normal header and footer and says what is happening
 * (with the link for anyone the script does not reach) instead of showing a bare path.
 *
 * `to` is the destination without query or hash; they are read from the address bar, because the
 * static export of this page cannot know them.
 */
export function LegacyForward({ to }: { to?: string }) {
  const pathname = usePathname();
  const { t } = useTranslation(undefined, { keyPrefix: 'website.forwarding' });
  const target = to ?? legacyForwardPath(pathname) ?? null;

  useEffect(() => {
    if (target) {
      window.location.replace(`${target}${window.location.search}${window.location.hash}`);
    }
  }, [target]);

  if (!target) {
    return null;
  }

  return (
    <WebsiteShell>
      <main
        role="status"
        className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-xl flex-col justify-center px-4 py-20"
      >
        <WebsiteLoggy pose="thinking" className="mb-6 h-28 w-auto self-start sm:h-36" />
        <h1 className="text-balance text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-balance text-base leading-7 text-text-secondary sm:text-lg">
          {t('description')}
        </p>
        <p className="mt-6 text-sm leading-6 text-text-secondary">
          {t('fallback')}{' '}
          <a href={target} className="font-semibold text-text-primary underline">
            {t('link')}
          </a>
        </p>
      </main>
    </WebsiteShell>
  );
}
