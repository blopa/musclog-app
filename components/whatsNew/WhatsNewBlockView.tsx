import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { OptionsSelector } from '@/components/OptionsSelector';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { WeekdayChoiceChips } from '@/components/WeekdayChoiceChips';
import { useTheme } from '@/hooks/useTheme';
import type { useWhatsNewChoiceValues } from '@/hooks/useWhatsNewChoiceValues';
import type { WhatsNewAction } from '@/utils/whatsNew/catalog';
import type { WhatsNewBlock } from '@/utils/whatsNew/schema';

import { whatsNewIcons } from './whatsNewIcons';

type Props = {
  block: WhatsNewBlock;
  choices: ReturnType<typeof useWhatsNewChoiceValues>;
  onAction: (action: WhatsNewAction) => void;
  disabled?: boolean;
};

export function WhatsNewBlockView({ block, choices, onAction, disabled }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const description =
    'descriptionKey' in block && block.descriptionKey ? t(block.descriptionKey) : undefined;
  switch (block.type) {
    case 'info': {
      const Icon = block.icon ? whatsNewIcons[block.icon] : null;
      return (
        <View className="gap-3">
          {Icon ? <Icon size={theme.iconSize['2xl']} color={theme.colors.accent.primary} /> : null}
          <Text accessibilityRole="header" className="text-2xl font-bold text-text-primary">
            {t(block.titleKey)}
          </Text>
          {description ? (
            <Text className="text-base leading-6 text-text-secondary">{description}</Text>
          ) : null}
        </View>
      );
    }
    case 'choice': {
      const value = choices.values[block.setting];
      const unavailable = disabled || !!choices.saving[block.setting];
      return (
        <View className="gap-3">
          {value === undefined ? (
            <View className="gap-2">
              <Text accessibilityRole="header" className="text-base font-bold text-text-primary">
                {t(block.titleKey)}
              </Text>
              {choices.errors[block.setting] ? (
                <>
                  <Text accessibilityRole="alert" className="text-sm text-text-secondary">
                    {t('whatsNew.loadFailed')}
                  </Text>
                  <TextButton label={t('whatsNew.retry')} onPress={choices.refresh} />
                </>
              ) : (
                <ActivityIndicator color={theme.colors.accent.primary} />
              )}
            </View>
          ) : block.options ? (
            <>
              {description ? (
                <Text className="text-sm text-text-secondary">{description}</Text>
              ) : null}
              <OptionsSelector
                title={t(block.titleKey)}
                selectedId={String(value)}
                disabled={unavailable}
                onSelect={(next) => void choices.write(block.setting, next)}
                options={block.options.map((option) => ({
                  id: option.value,
                  label: t(option.labelKey),
                  description: option.descriptionKey ? t(option.descriptionKey) : '',
                  icon: whatsNewIcons[option.icon ?? 'settings'],
                  iconColor: theme.colors.accent.primary,
                  iconBgColor: theme.colors.accent.primary20,
                }))}
              />
            </>
          ) : typeof value === 'boolean' ? (
            <ToggleInput
              items={[
                {
                  key: block.setting,
                  label: t(block.titleKey),
                  subtitle: description,
                  value,
                  disabled: unavailable,
                  onValueChange: (next) => void choices.write(block.setting, next),
                },
              ]}
            />
          ) : (
            <>
              <Text accessibilityRole="header" className="text-base font-bold text-text-primary">
                {t(block.titleKey)}
              </Text>
              {description ? (
                <Text className="text-sm text-text-secondary">{description}</Text>
              ) : null}
              <WeekdayChoiceChips
                value={Number(value)}
                disabled={unavailable}
                onChange={(next) => void choices.write(block.setting, next)}
              />
            </>
          )}
          {value !== undefined && choices.errors[block.setting] ? (
            <Text accessibilityRole="alert" className="text-sm text-status-error">
              {t('whatsNew.saveFailed')}
            </Text>
          ) : null}
        </View>
      );
    }
    case 'featureList':
      return (
        <View className="gap-3">
          {block.titleKey ? (
            <Text accessibilityRole="header" className="text-2xl font-bold text-text-primary">
              {t(block.titleKey)}
            </Text>
          ) : null}
          {block.items.map((item) => {
            const Icon = whatsNewIcons[item.icon];
            return item.action ? (
              <ListRow
                key={item.id}
                title={t(item.labelKey)}
                subtitle={item.descriptionKey ? t(item.descriptionKey) : undefined}
                icon={Icon}
                disabled={disabled}
                onPress={() => onAction(item.action!)}
              />
            ) : (
              <View
                key={item.id}
                className="flex-row items-center gap-3 rounded-xl bg-bg-overlay px-4 py-3"
              >
                <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-text-primary">
                    {t(item.labelKey)}
                  </Text>
                  {item.descriptionKey ? (
                    <Text className="text-sm text-text-secondary">{t(item.descriptionKey)}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'action':
      return (
        <View className="gap-2">
          <Button
            variant="outline"
            label={t(block.labelKey)}
            icon={block.icon ? whatsNewIcons[block.icon] : undefined}
            disabled={disabled}
            onPress={() => onAction(block.action)}
          />
          {description ? <Text className="text-sm text-text-secondary">{description}</Text> : null}
        </View>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
