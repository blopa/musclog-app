import { Cpu } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppleIntelligenceStatus } from '@/components/localModels/AppleIntelligenceStatus';
import { LocalModelCard } from '@/components/localModels/LocalModelCard';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { disableOnDeviceAi, enableOnDeviceAi, setOnDeviceEngine } from '@/services/onDeviceAiSetup';
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
} from '@/utils/localModels/install';
import { hasLocalAiOption } from '@/utils/onDeviceStatus';

type OnDeviceAiSectionProps = {
  /** Musclog Iron or the free tier is on: they outrank AI on the phone. */
  hostedProviderActive: boolean;
};

/**
 * AI on this phone, in AI settings: the switch, which engine answers (Apple Intelligence or the
 * downloaded model), the model's download card and the notes that go with them. Shown only where
 * this phone has at least one way to run AI locally.
 */
export function OnDeviceAiSection({ hostedProviderActive }: OnDeviceAiSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { useOnDeviceAi } = useSettings();
  const [optimistic, setOptimistic] = useState<{ base: boolean; value: boolean } | null>(null);
  const status = useOnDeviceStatus({ refresh: true });
  const [selection, setSelection] = useState<LocalModelSelection>(DEFAULT_LOCAL_MODEL_SELECTION);
  const enabled =
    optimistic && optimistic.base === useOnDeviceAi ? optimistic.value : useOnDeviceAi;

  if (!hasLocalAiOption(status)) {
    return null;
  }

  const bothEngines = status.options.apple && status.options.model;
  const usesApple = status.engine === 'apple';
  const note = { color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs };

  const handleToggle = (value: boolean) => {
    const next = { base: useOnDeviceAi, value };
    setOptimistic(next);
    const update = value ? enableOnDeviceAi(usesApple ? 'apple' : 'gguf') : disableOnDeviceAi();
    // A failed save is reported by the setup service; the switch goes back to the stored value.
    void update.then((ok) => {
      if (!ok) {
        setOptimistic((prev) => (prev === next ? null : prev));
      }
    });
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
        <AppleIntelligenceStatus appleState={status.appleState} tone="note" className="px-1" />
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
