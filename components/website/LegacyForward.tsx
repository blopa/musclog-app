import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { legacyForwardPath } from './localeRoutes';

/**
 * The page behind an old, unprefixed address (`/tools/protein-calculator`, `/`): it forwards the
 * browser to the same page in English (`/en/tools/protein-calculator`). The site is static files, so
 * this is the browser's job. The link stays on the page for anyone the script does not reach.
 *
 * `to` is the destination without query or hash; they are read from the address bar, because the
 * static export of this page cannot know them.
 */
export function LegacyForward({ to }: { to?: string }) {
  const pathname = usePathname();
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
    <main className="container mx-auto max-w-3xl px-4 py-24">
      <a href={target} className="text-base font-semibold underline">
        {target}
      </a>
    </main>
  );
}
