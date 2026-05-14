import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot } from 'expo-router';

import { WebsiteChrome } from '@/components/website/WebsiteChrome';
import { WebsiteProviders } from '@/components/website/WebsiteProviders';

export default function WebsiteLayout() {
  return (
    <WebsiteProviders>
      <WebsiteChrome>
        <Slot />
      </WebsiteChrome>
    </WebsiteProviders>
  );
}
