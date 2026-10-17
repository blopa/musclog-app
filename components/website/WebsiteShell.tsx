import type { ReactNode } from 'react';

import { WebsiteProviders } from './WebsiteProviders';
import { WebsiteSeoForCurrentRoute } from './WebsiteSeo';
import { WebsiteOrganizationJsonLd } from './WebsiteStructuredData';
import { WebsiteWrapper } from './WebsiteWrapper';

/** Shared chrome for the public root and the grouped website routes. */
export function WebsiteShell({ children }: { children: ReactNode }) {
  return (
    <WebsiteProviders>
      <WebsiteSeoForCurrentRoute />
      <WebsiteOrganizationJsonLd />
      <WebsiteWrapper>{children}</WebsiteWrapper>
    </WebsiteProviders>
  );
}
