import { View } from 'react-native';

import { BootProgressBar } from '@/components/BootProgressBar';
import { useBootProgress } from '@/utils/bootProgress';

export function BootProgressOverlay() {
  const progress = useBootProgress();

  if (!progress.active || progress.total <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 36,
        alignItems: 'center',
      }}
    >
      <BootProgressBar progress={progress} />
    </View>
  );
}
