import { Cloud } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { SettingsCard } from '@/components/cards/SettingsCard';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { usePremium } from '@/hooks/usePremium';
import type { PremiumViewModel } from '@/utils/premium/premiumUiState';

type PremiumCardProps = {
  onPress: () => void;
};

/** Plain row text for each phase; the modal carries the detail. */
function useCardSubtitle(view: PremiumViewModel): string {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  switch (view.phase) {
    case 'not_subscribed':
      return t('premium.card.notSubscribed');
    case 'active':
      if (view.usedPct !== null && view.devices) {
        return t('premium.card.active', {
          pct: formatInteger(Math.round(view.usedPct)),
          count: formatInteger(view.devices.count),
          max: formatInteger(view.devices.max),
        });
      }

      return t('premium.card.checking');
    case 'exhausted':
      return t('premium.card.exhausted');
    case 'removed':
      return t('premium.card.removed');
    case 'revoked':
      return t('premium.card.revoked');
    default:
      return t('premium.card.checking');
  }
}

/** The Premium row in Settings. Renders nothing while Premium is switched off in this build. */
export function PremiumCard({ onPress }: PremiumCardProps) {
  const { t } = useTranslation();
  const { enabled, view } = usePremium();
  const subtitle = useCardSubtitle(view);

  if (!enabled) {
    return null;
  }

  return (
    <SettingsCard
      icon={<Cloud />}
      title={t('premium.title')}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
}
