import '@/database';
import '@/global.css';
import '@/lang/lang';

import { Slot } from 'expo-router';

import { WebsiteShell } from '@/components/website/WebsiteShell';

export default function WebsiteLayout() {
  return (
    <WebsiteShell>
      <Slot />
    </WebsiteShell>
  );
}
