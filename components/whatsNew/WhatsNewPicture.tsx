import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { LoggyPose, useLoggyVisible } from '@/components/LoggyPose';
import type { WhatsNewPoseName } from '@/utils/whatsNew/catalog';

import { WhatsNewIconBadge } from './WhatsNewIconBadge';

/** Large enough to read as the page's picture, small enough to leave room for the switches below. */
const LOGGY_HEIGHT = 160;

/**
 * The picture above an info block's heading: Loggy in `pose` when the block names one, otherwise
 * its icon in the accent circle. With "Show Loggy" off the pose is not drawn and the icon stands
 * in, so the page never opens on a gap.
 */
export function WhatsNewPicture({
  icon,
  pose,
}: {
  icon?: LucideIcon | null;
  pose?: WhatsNewPoseName;
}) {
  const loggyVisible = useLoggyVisible();

  if (pose && loggyVisible) {
    return (
      <View className="items-center">
        <LoggyPose pose={pose} height={LOGGY_HEIGHT} />
      </View>
    );
  }

  return icon ? <WhatsNewIconBadge icon={icon} /> : null;
}
