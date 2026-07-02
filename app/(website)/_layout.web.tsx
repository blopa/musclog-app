import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot } from 'expo-router';

import { WebsiteProviders } from '@/components/website/WebsiteProviders';
import { WebsiteSeoForCurrentRoute } from '@/components/website/WebsiteSeo';
import { WebsiteWrapper } from '@/components/website/WebsiteWrapper';

export default function WebsiteLayout() {
  return (
    <WebsiteProviders>
      <WebsiteSeoForCurrentRoute />
      <WebsiteWrapper>
        <Slot />
      </WebsiteWrapper>
    </WebsiteProviders>
  );
}
