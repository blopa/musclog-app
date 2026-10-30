import { Megaphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { pageHeadlineDetailKeys, pageHeadlineKey, type WhatsNewFlow } from '@/utils/whatsNew/flow';

import { WhatsNewIconBadge } from './WhatsNewIconBadge';

/**
 * The tour's first page. It is centred in the space the footer leaves, leads with a large icon and
 * larger type than the pages after it, and — for an upgrade — lists what the pages cover, so the
 * person knows what the tour holds before choosing to take it or skip it.
 */
export function WhatsNewIntro({
  flow,
  showHighlights,
}: {
  flow: WhatsNewFlow;
  showHighlights: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const headlines = showHighlights
    ? flow.pages.flatMap((page) => {
        const key = pageHeadlineKey(page);
        return key ? [{ id: page.key, key, detailKeys: pageHeadlineDetailKeys(page) }] : [];
      })
    : [];

  return (
    <View className="flex-1 justify-center gap-6 py-6">
      <View className="items-center gap-5">
        <WhatsNewIconBadge icon={Megaphone} size="hero" />
        <Text
          accessibilityRole="header"
          className="text-center text-4xl font-bold text-text-primary"
        >
          {t('whatsNew.intro.title')}
        </Text>
        <Text className="text-center text-lg leading-7 text-text-secondary">
          {t('whatsNew.intro.description')}
        </Text>
        {showHighlights && flow.truncated ? (
          <Text className="text-center text-sm text-text-secondary">
            {t('whatsNew.intro.truncated')}
          </Text>
        ) : null}
      </View>

      {headlines.length > 0 ? (
        <View className="gap-3 rounded-card bg-bg-overlay p-4">
          <Text className="text-xs font-semibold text-text-secondary">
            {t('whatsNew.intro.inside')}
          </Text>
          {headlines.map((headline, index) => (
            <View key={headline.id} className="flex-row items-start gap-3">
              <View
                className="items-center justify-center rounded-full bg-accent-primary/15"
                style={{ width: theme.iconSize['2xl'], height: theme.iconSize['2xl'] }}
              >
                <Text className="text-sm font-semibold text-accent-primary">
                  {formatInteger(index + 1)}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-text-primary">{t(headline.key)}</Text>
                {headline.detailKeys.length > 0 ? (
                  <Text className="text-sm text-text-secondary">
                    {headline.detailKeys.map((key) => t(key)).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
