import { useTranslation } from 'react-i18next';
import { Linking, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** Whole keys, so the translation check sees each one, and where each source states its terms. */
const CREDITS: Record<string, { textKey: string; url: string | null }> = {
  openfood: {
    textKey: 'foodSearch.credit.openFoodFacts',
    url: 'https://world.openfoodfacts.org/terms-of-use',
  },
  usda: { textKey: 'foodSearch.credit.usda', url: 'https://fdc.nal.usda.gov/' },
  musclog: { textKey: 'foodSearch.credit.musclog', url: null },
};

/**
 * Says where a food's data came from. Open Food Facts requires this credit wherever its data is
 * shown; foods the person made themselves get none.
 */
export function FoodSourceCredit({ source }: { source: string | null | undefined }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const credit = source ? CREDITS[source] : undefined;

  if (!credit) {
    return null;
  }

  const { url } = credit;

  return (
    <Text
      accessibilityRole={url ? 'link' : undefined}
      onPress={url ? () => void Linking.openURL(url).catch(() => undefined) : undefined}
      className="px-1 pt-2"
      style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs }}
    >
      {t(credit.textKey)}
    </Text>
  );
}
