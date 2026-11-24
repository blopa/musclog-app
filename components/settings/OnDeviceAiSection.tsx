import { Cpu } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { LocalModelCard } from '@/components/localModels/LocalModelCard';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useTheme } from '@/hooks/useTheme';
import { disableOnDeviceAi, enableOnDeviceAi, setOnDeviceEngine } from '@/services/onDeviceAiSetup';
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
} from '@/utils/localModels/install';
import { isAppleLocaleSupported } from '@/utils/onDeviceAi';
import { hasLocalAiOption } from '@/utils/onDeviceStatus';

const APPLE_STATUS_KEYS = {
  ready: 'onDeviceAi.apple.status.ready',
  appleOff: 'onDeviceAi.apple.status.appleOff',
  appleNotReady: 'onDeviceAi.apple.status.appleNotReady',
} as const;

type OnDeviceAiSectionProps = {
  /** The stored `use_on_device_ai` value (the modal's debounced copy, so the switch is instant). */
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  /** Musclog Iron or the free tier is on: they outrank AI on the phone. */
  hostedProviderActive: boolean;
};

/**
 * AI on this phone, in AI settings: the switch, which engine answers (Apple Intelligence or the
 * downloaded model), the model's download card and the notes that go with them. Shown only where
 * this phone has at least one way to run AI locally.
 */
export function OnDeviceAiSection({
  enabled,
  onEnabledChange,
  hostedProviderActive,
}: OnDeviceAiSectionProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const status = useOnDeviceStatus({ refresh: true });
  const [selection, setSelection] = useState<LocalModelSelection>(DEFAULT_LOCAL_MODEL_SELECTION);
  const [appleLanguageOk, setAppleLanguageOk] = useState(true);
  const offersApple = status.options.apple;

  useEffect(() => {
    let cancelled = false;
    if (offersApple) {
      void isAppleLocaleSupported(i18n.language).then((ok) => {
        if (!cancelled) {
          setAppleLanguageOk(ok);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [offersApple, i18n.language]);

  if (!hasLocalAiOption(status)) {
    return null;
  }

  const bothEngines = status.options.apple && status.options.model;
  const usesApple = status.engine === 'apple';
  const note = { color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs };
  const appleStatusKey =
    usesApple && status.state in APPLE_STATUS_KEYS
      ? APPLE_STATUS_KEYS[status.state as keyof typeof APPLE_STATUS_KEYS]
      : null;

  const handleToggle = (value: boolean) => {
    onEnabledChange(value);
    if (value) {
      void enableOnDeviceAi(usesApple ? 'apple' : 'gguf');
    } else {
      void disableOnDeviceAi();
    }
  };

  return (
    <View className="gap-3">
      <Text className="px-5 text-xs font-semibold" style={{ color: theme.colors.accent.primary }}>
        {t('onDeviceAi.settings.sectionTitle')}
      </Text>

      <ToggleInput
        items={[
          {
            key: 'use-on-device-ai',
            label: t('onDeviceAi.settings.toggle'),
            subtitle: t('onDeviceAi.settings.toggleSubtitle'),
            value: enabled,
            onValueChange: handleToggle,
            icon: (
              <View
                style={{
                  width: theme.size['8'],
                  height: theme.size['8'],
                  borderRadius: theme.borderRadius.full / 2,
                  backgroundColor: theme.colors.status.success20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Cpu size={theme.iconSize.md} color={theme.colors.status.success} />
              </View>
            ),
          },
        ]}
      />

      {bothEngines ? (
        <View className="gap-2 px-1">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('onDeviceAi.settings.engineLabel')}
          </Text>
          <SegmentedControl
            variant="pill"
            fullWidth
            value={status.engine}
            onValueChange={(value) => void setOnDeviceEngine(value === 'apple' ? 'apple' : 'gguf')}
            options={[
              { label: t('onDeviceAi.settings.engine.apple'), value: 'apple' },
              { label: t('onDeviceAi.settings.engine.model'), value: 'gguf' },
            ]}
          />
        </View>
      ) : null}

      {usesApple ? (
        <View className="gap-2 px-1">
          {appleStatusKey ? <Text style={note}>{t(appleStatusKey)}</Text> : null}
          {!appleLanguageOk ? <Text style={note}>{t('onDeviceAi.apple.languageNote')}</Text> : null}
          {status.state === 'appleOff' ? (
            <Button
              label={t('onDeviceAi.apple.openSettings')}
              variant="outline"
              width="full"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      ) : (
        <LocalModelCard selection={selection} onSelectionChange={setSelection} allowDelete />
      )}

      {enabled && hostedProviderActive ? (
        <Text className="px-5" style={note}>
          {t('onDeviceAi.settings.priorityNote')}
        </Text>
      ) : null}

      <Text className="px-5" style={note}>
        {t('onDeviceAi.settings.privacyNote')}
      </Text>
    </View>
  );
}
