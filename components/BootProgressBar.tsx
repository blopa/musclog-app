import { Text, View } from 'react-native';

import i18n from '@/lang/lang';
import { BootProgressState } from '@/utils/bootProgress';

type BootProgressBarProps = {
  progress: BootProgressState;
};

export const BOOT_PROGRESS_ACCENT_COLOR = '#10b981';
const BOOT_PROGRESS_TRACK_COLOR = '#1c3829';
const BOOT_PROGRESS_TEXT_COLOR = '#587068';

export function BootProgressBar({ progress }: BootProgressBarProps) {
  if (!progress.active || progress.total <= 0) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, progress.completed / progress.total));
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio);

  return (
    <View style={{ width: '70%', maxWidth: 280, alignItems: 'center' }}>
      <View
        style={{
          width: '100%',
          height: 6,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: BOOT_PROGRESS_TRACK_COLOR,
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: BOOT_PROGRESS_ACCENT_COLOR,
          }}
        />
      </View>
      <Text
        style={{
          marginTop: 8,
          color: BOOT_PROGRESS_TEXT_COLOR,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {percent}
      </Text>
    </View>
  );
}
