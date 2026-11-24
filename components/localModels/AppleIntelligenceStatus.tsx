import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { isAppleLocaleSupported } from '@/utils/onDeviceAi';
import type { OnDeviceStatusState } from '@/utils/onDeviceStatus';

/** One whole key per Apple state worth saying, so the translation check sees each sentence. */
const APPLE_STATUS_KEYS = {
  ready: 'onDeviceAi.apple.status.ready',
  appleOff: 'onDeviceAi.apple.status.appleOff',
  appleNotReady: 'onDeviceAi.apple.status.appleNotReady',
} as const;

type AppleIntelligenceStatusProps = {
  appleState: OnDeviceStatusState;
  /** `'note'` in Settings (tertiary, xs) or `'body'` in Onboarding (secondary, sm). */
  tone?: 'note' | 'body';
  className?: string;
};

/**
 * Apple Intelligence readiness message, unsupported-language note and Settings shortcut.
 * Shared between AI Settings and the on-device AI onboarding options screen.
 */
export function AppleIntelligenceStatus({
  appleState,
  tone = 'note',
  className,
}: AppleIntelligenceStatusProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [appleLanguageOk, setAppleLanguageOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void isAppleLocaleSupported(i18n.language).then((ok) => {
      if (!cancelled) {
        setAppleLanguageOk(ok);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const statusKey =
    appleState in APPLE_STATUS_KEYS
      ? APPLE_STATUS_KEYS[appleState as keyof typeof APPLE_STATUS_KEYS]
      : null;
  const showOpenSettings = appleState === 'appleOff';

  if (!statusKey && appleLanguageOk && !showOpenSettings) {
    return null;
  }

  const textStyle =
    tone === 'body'
      ? { color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }
      : { color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs };

  return (
    <View className={className ? `gap-2 ${className}` : 'gap-2'}>
      {statusKey ? <Text style={textStyle}>{t(statusKey)}</Text> : null}
      {!appleLanguageOk ? (
        <Text style={textStyle}>{t('onDeviceAi.apple.languageNote')}</Text>
      ) : null}
      {showOpenSettings ? (
        <Button
          label={t('onDeviceAi.apple.openSettings')}
          variant="outline"
          width="full"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </View>
  );
}
