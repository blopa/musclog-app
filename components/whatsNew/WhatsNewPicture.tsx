import type { LucideIcon } from 'lucide-react-native';
import { useWindowDimensions, View } from 'react-native';

import { LoggyPose, useLoggyVisible } from '@/components/LoggyPose';
import type { WhatsNewPoseName } from '@/utils/whatsNew/catalog';

import { WhatsNewIconBadge } from './WhatsNewIconBadge';

/** The pose takes this share of the window's height, so a tall phone gets a big Loggy... */
const LOGGY_HEIGHT_SHARE = 0.22;
/** ...within these bounds: never a thumbnail, and never so tall the copy below leaves the screen. */
const LOGGY_MIN_HEIGHT = 120;
const LOGGY_MAX_HEIGHT = 190;

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
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.round(
    Math.min(LOGGY_MAX_HEIGHT, Math.max(LOGGY_MIN_HEIGHT, windowHeight * LOGGY_HEIGHT_SHARE))
  );

  if (pose && loggyVisible) {
    return (
      <View className="items-center">
        <LoggyPose pose={pose} height={height} />
      </View>
    );
  }

  return icon ? <WhatsNewIconBadge icon={icon} /> : null;
}
