import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot } from 'expo-router';

import { WebsiteProviders } from '@/components/website/WebsiteProviders';

export default function WebsiteLayout() {
  return (
    <WebsiteProviders>
      <Slot />
    </WebsiteProviders>
  );
}
