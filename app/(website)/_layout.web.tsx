import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot, usePathname } from 'expo-router';

import { LegacyForward } from '@/components/website/LegacyForward';
import { legacyForwardPath } from '@/components/website/localeRoutes';
import { useWebsiteLanguage } from '@/components/website/WebsiteLanguage';
import { WebsiteShell } from '@/components/website/WebsiteShell';

export default function WebsiteLayout() {
  // Before the shell renders: its header and footer are translated too.
  useWebsiteLanguage();
  const forwardTo = legacyForwardPath(usePathname());

  // `/tools` is read by the router as `[locale]` = "tools". The exported site serves a copy of the English page at every unprefixed address (`scripts/write-unprefixed-pages.js`); this is what the development server shows instead.
  if (forwardTo) {
    return <LegacyForward to={forwardTo} />;
  }

  return (
    <WebsiteShell>
      <Slot />
    </WebsiteShell>
  );
}
