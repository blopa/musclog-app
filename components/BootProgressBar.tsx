import { Text, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import i18n from '@/lang/lang';
import { colors } from '@/theme.tokens';
import { useBootProgressDisplay } from '@/utils/bootProgress';

// Static launch-time inset (no SafeAreaProvider wraps the splash), used to lift
// the bar clear of the Android navigation bar / iOS home indicator.
const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

/**
 * Absolute-positioned progress bar anchored near the bottom of the splash
 * loading screen while boot migrations run. Only rendered inside
 * SplashLoading, so it disappears with the splash once the app is ready,
 * even if migrations are still finishing in the background.
 * Colors come from theme.tokens (not theme.ts) so this stays importable
 * before the database layer loads.
 */
export function BootProgressBar() {
  const { active, ratio: rawRatio } = useBootProgressDisplay();

  if (!active) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, rawRatio));
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: BOTTOM_INSET + 72,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '70%', maxWidth: 280, alignItems: 'center' }}>
        <Text
          style={{
            marginBottom: 12,
            color: colors.gray500,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {i18n.t('common.bootMayTakeMinutes')}
        </Text>
        <View
          style={{
            width: '100%',
            height: 6,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: colors.darkViridian,
          }}
        >
          <View
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: colors.jade,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: 8,
            color: colors.gray500,
            fontSize: 12,
            fontWeight: '600',
          }}
        >
          {percent}
        </Text>
      </View>
    </View>
  );
}
