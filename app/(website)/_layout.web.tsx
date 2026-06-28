import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot } from 'expo-router';

import { WebsiteChrome } from '@/components/website/WebsiteChrome';
import { WebsiteProviders } from '@/components/website/WebsiteProviders';
import { WebsiteSeoForCurrentRoute } from '@/components/website/WebsiteSeo';

export default function WebsiteLayout() {
  return (
    <WebsiteProviders>
      <WebsiteSeoForCurrentRoute />
      <WebsiteChrome>
        <Slot />
      </WebsiteChrome>
    </WebsiteProviders>
  );
}
