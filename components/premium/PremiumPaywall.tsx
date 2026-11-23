import {
  Gauge,
  HeartHandshake,
  KeyRound,
  type LucideIcon,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * What Premium gives, in the order the paywall lists it. Every line must stay true of the Worker as
 * configured: ZDR-only routing (`assertPremiumPrivacy`), an allowance per subscription shared by its
 * devices, no account, and meal photos (hosted vision is on, `vision_enabled` in the Worker's
 * `AI_CONFIG_JSON`), so a line may mention them.
 */
export const PREMIUM_BENEFITS: readonly {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}[] = [
  {
    id: 'noSetup',
    icon: KeyRound,
    titleKey: 'premium.paywall.benefits.noSetup.title',
    descKey: 'premium.paywall.benefits.noSetup.desc',
  },
  {
    id: 'private',
    icon: ShieldCheck,
    titleKey: 'premium.paywall.benefits.private.title',
    descKey: 'premium.paywall.benefits.private.desc',
  },
  {
    id: 'allowance',
    icon: Gauge,
    titleKey: 'premium.paywall.benefits.allowance.title',
    descKey: 'premium.paywall.benefits.allowance.desc',
  },
  {
    id: 'devices',
    icon: Smartphone,
    titleKey: 'premium.paywall.benefits.devices.title',
    descKey: 'premium.paywall.benefits.devices.desc',
  },
  {
    id: 'openSource',
    icon: HeartHandshake,
    titleKey: 'premium.paywall.benefits.openSource.title',
    descKey: 'premium.paywall.benefits.openSource.desc',
  },
];

/** The free tier against Premium, one row per question a buyer asks. Whole keys, for the check. */
export const PREMIUM_COMPARISON_ROWS: readonly {
  id: string;
  labelKey: string;
  freeKey: string;
  premiumKey: string;
}[] = [
  {
    id: 'privacy',
    labelKey: 'premium.paywall.compare.privacy.label',
    freeKey: 'premium.paywall.compare.privacy.free',
    premiumKey: 'premium.paywall.compare.privacy.premium',
  },
  {
    id: 'limit',
    labelKey: 'premium.paywall.compare.limit.label',
    freeKey: 'premium.paywall.compare.limit.free',
    premiumKey: 'premium.paywall.compare.limit.premium',
  },
];

/** The paywall's opening: what the person gets, said once and large, before any price. */
export function PremiumPaywallHero() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="font-bold"
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize['3xl'],
          lineHeight: theme.typography.fontSize['3xl'] * 1.2,
        }}
      >
        {t('premium.paywall.headline')}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.typography.fontSize.base,
          lineHeight: theme.typography.fontSize.base * 1.45,
        }}
      >
        {t('premium.paywall.subhead')}
      </Text>
    </View>
  );
}

/** Each benefit as an icon, a short title and one supporting line. */
export function PremiumBenefitList() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="gap-5">
      {PREMIUM_BENEFITS.map(({ id, icon: Icon, titleKey, descKey }) => (
        <View key={id} className="flex-row items-start gap-4">
          <View
            className="h-11 w-11 shrink-0 items-center justify-center rounded-control"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Icon size={22} color={theme.colors.accent.primary} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="font-semibold"
              style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
            >
              {t(titleKey)}
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: theme.typography.fontSize.sm * 1.45,
              }}
            >
              {t(descKey)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Free tier and Premium side by side. Each row is a label over two cells that wrap onto their own
 * lines when a translation is too long to share the width (`basis` plus `grow`, never `flex-1`).
 */
export function PremiumComparison({ priceString }: { priceString: string | null }) {
  const theme = useTheme();
  const { t } = useTranslation();
  // The price row reads the store's own string, never a number written into the copy.
  const rows = [
    ...PREMIUM_COMPARISON_ROWS.map(({ id, labelKey, freeKey, premiumKey }) => ({
      id,
      label: t(labelKey),
      free: t(freeKey),
      premium: t(premiumKey),
    })),
    {
      id: 'price',
      label: t('premium.paywall.compare.price.label'),
      free: t('premium.paywall.compare.price.free'),
      premium: priceString
        ? t('premium.price', { price: priceString })
        : t('premium.paywall.compare.price.premiumUnknown'),
    },
  ];

  // The tier's name sits inside its own cell, so a row that wraps onto two lines never leaves a
  // value under the wrong heading.
  const cell = (tier: string, text: string, highlighted: boolean) => (
    <View
      className="grow basis-[130px] gap-1 rounded-control p-3"
      style={{
        backgroundColor: highlighted ? theme.colors.accent.primary10 : theme.colors.background.ink5,
        borderWidth: 1,
        borderColor: highlighted ? theme.colors.accent.primary : 'transparent',
      }}
    >
      <Text
        className="font-semibold"
        style={{
          color: highlighted ? theme.colors.accent.primary : theme.colors.text.tertiary,
          fontSize: theme.typography.fontSize.xs,
        }}
      >
        {tier}
      </Text>
      <Text
        className={highlighted ? 'font-semibold' : undefined}
        style={{
          color: highlighted ? theme.colors.text.primary : theme.colors.text.secondary,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.fontSize.sm * 1.4,
        }}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View
      className="gap-4 rounded-card p-4"
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
      }}
    >
      <Text
        accessibilityRole="header"
        className="font-bold"
        style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.lg }}
      >
        {t('premium.paywall.compare.title')}
      </Text>
      {rows.map(({ id, label, free, premium }) => (
        <View key={id} className="gap-2">
          <Text
            className="font-semibold"
            style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.sm }}
          >
            {label}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {cell(t('premium.paywall.compare.free'), free, false)}
            {cell(t('premium.paywall.compare.premium'), premium, true)}
          </View>
        </View>
      ))}
    </View>
  );
}
