import { useRouter } from 'expo-router';

import { useWhatsNewAutoFlow } from '@/hooks/useWhatsNewAutoFlow';

import { WhatsNewModal } from './WhatsNewModal';

export function WhatsNewAutoPrompt({ suppressed }: { suppressed: boolean }) {
  const router = useRouter();
  const { flow, visible, dismiss } = useWhatsNewAutoFlow({ suppressed });
  return flow ? (
    <WhatsNewModal
      visible={visible}
      flow={flow}
      mode="upgrade"
      onDismiss={dismiss}
      onNavigate={(route) => router.navigate(route)}
    />
  ) : null;
}
