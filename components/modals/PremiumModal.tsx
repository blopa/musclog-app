import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { formatRenewalDate, PremiumUsageBar } from '@/components/premium/PremiumUsageBar';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { usePremium } from '@/hooks/usePremium';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import {
  manageSubscriptionUrl,
  PREMIUM_PRIVACY_URL,
  PREMIUM_TERMS_URL,
} from '@/utils/premium/premiumLinks';
import type { PremiumNotice } from '@/utils/premium/premiumUiState';

/** What a notice looks like: info is neutral, warning and error are the status hues. */
export type PremiumNoticeTone = 'info' | 'warning' | 'error';

/** One whole key per notice, so the translation check sees every string the screen can show. */
export const PREMIUM_NOTICE_KEYS: Record<PremiumNotice, string> = {
  offline: 'premium.notice.offline',
  purchase_cancelled: 'premium.notice.purchase_cancelled',
  purchase_failed: 'premium.notice.purchase_failed',
  restore_nothing: 'premium.notice.restore_nothing',
  confirming: 'premium.notice.confirming',
  removed: 'premium.notice.removed',
  revoked: 'premium.notice.revoked',
  exhausted: 'premium.notice.exhausted',
  at_capacity: 'premium.notice.at_capacity',
  unavailable: 'premium.notice.unavailable',
  not_accepting: 'premium.notice.not_accepting',
  not_available: 'premium.notice.not_available',
  warning80: 'premium.notice.warning80',
};

export const PREMIUM_NOTICE_TONE: Record<PremiumNotice, PremiumNoticeTone> = {
  offline: 'warning',
  purchase_cancelled: 'info',
  purchase_failed: 'error',
  restore_nothing: 'info',
  confirming: 'info',
  removed: 'warning',
  revoked: 'warning',
  exhausted: 'warning',
  at_capacity: 'info',
  unavailable: 'error',
  not_accepting: 'info',
  not_available: 'info',
  warning80: 'warning',
};

/**
 * What the switch does for a requested value. Turning it on needs the consent first, unless the
 * person already gave it for this version of the terms.
 */
export function hostedToggleDecision(
  next: boolean,
  consentNeeded: boolean
): 'off' | 'on' | 'ask_consent' {
  if (!next) {
    return 'off';
  }

  return consentNeeded ? 'ask_consent' : 'on';
}

/** The text colour a notice of this tone is drawn in. */
function toneColor(tone: PremiumNoticeTone | null, theme: Theme): string {
  switch (tone) {
    case 'error':
      return theme.colors.status.error;
    case 'warning':
      return theme.colors.status.warning;
    default:
      return theme.colors.text.secondary;
  }
}

type PremiumDialog = 'consent' | 'reset';

type PremiumModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PremiumModal({ visible, onClose }: PremiumModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const premium = usePremium();
  const { view, busy } = premium;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [pressed, setPressed] = useState<'subscribe' | 'restore' | null>(null);
  // One ConfirmationModal serves both questions: two siblings would hit the iOS presenter bug.
  const [dialogOpen, setDialogOpen] = useSubModalVisibility(visible);
  const [dialog, setDialog] = useState<PremiumDialog>('consent');
  const renewal = formatRenewalDate(view.resetsAt, locale);
  const manageUrl = manageSubscriptionUrl(Platform.OS);

  const openDialog = (next: PremiumDialog) => {
    setDialog(next);
    setDialogOpen(true);
  };

  const runStore = async (kind: 'subscribe' | 'restore', action: () => Promise<boolean>) => {
    setPressed(kind);

    try {
      const ok = await action();

      // A purchase or restore that succeeds still needs the consent before the switch can turn on.
      if (ok && premium.consentNeeded(true)) {
        openDialog('consent');
      }
    } finally {
      setPressed(null);
    }
  };

  const handleToggle = async (on: boolean) => {
    if (hostedToggleDecision(on, premium.consentNeeded(true)) === 'ask_consent') {
      openDialog('consent');

      return;
    }

    await premium.setUseHostedAi(on);
  };

  const confirmConsent = async () => {
    await premium.recordConsent();
    await premium.setUseHostedAi(true);
  };

  const confirmReset = async () => {
    await premium.reset();
  };

  const notice = view.notice;
  const noticeTone = notice ? PREMIUM_NOTICE_TONE[notice] : null;
  const noticeColor = toneColor(noticeTone, theme);

  const renderNotice = () => {
    if (!notice) {
      return null;
    }

    const text =
      notice === 'exhausted' && renewal
        ? t(PREMIUM_NOTICE_KEYS[notice], { date: renewal })
        : notice === 'exhausted'
          ? t('premium.notice.exhaustedNoDate')
          : t(PREMIUM_NOTICE_KEYS[notice]);

    return (
      <View
        className="rounded-control border-l-4 p-3"
        style={{
          borderColor: noticeColor,
          borderLeftWidth: 4,
          backgroundColor: theme.colors.background.ink10,
        }}
      >
        <Text style={{ color: noticeColor, fontSize: theme.typography.fontSize.sm }}>{text}</Text>
      </View>
    );
  };

  const renderRestore = (variant: 'outline' | 'accent') => (
    <Button
      label={t('premium.restore')}
      variant={variant}
      width="full"
      disabled={busy}
      loading={busy ? pressed === 'restore' : undefined}
      onPress={() => runStore('restore', () => premium.restore())}
    />
  );

  const renderNotSubscribed = () => (
    <View className="gap-3">
      {premium.priceString ? (
        <Text
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
        >
          {t('premium.price', { price: premium.priceString })}
        </Text>
      ) : null}
      {view.canSubscribe ? (
        <Button
          label={t('premium.subscribe')}
          variant="accent"
          width="full"
          disabled={busy}
          loading={busy ? pressed === 'subscribe' : undefined}
          onPress={() => runStore('subscribe', () => premium.subscribe())}
        />
      ) : null}
      {view.canRestore ? renderRestore('outline') : null}
    </View>
  );

  const renderUsable = () => (
    <View className="gap-4">
      {view.showUsage && view.usedPct !== null ? (
        <PremiumUsageBar usedPct={view.usedPct} resetsAt={view.resetsAt} />
      ) : null}
      {view.devices ? (
        <Text
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
        >
          {t('premium.devices', {
            count: formatInteger(view.devices.count),
            max: formatInteger(view.devices.max),
          })}
        </Text>
      ) : null}
      <ToggleInput
        items={[
          {
            key: 'use-premium-ai',
            label: t('premium.useForAi'),
            subtitle: t('premium.useForAiHint'),
            value: premium.useHostedAi,
            // Switching it off stays possible when the period has run out; only switching on needs an active one.
            disabled: !(view.canUseHosted || premium.useHostedAi) || busy,
            onValueChange: (on: boolean) => {
              handleToggle(on);
            },
          },
        ]}
      />
      {manageUrl ? (
        <Button
          label={t('premium.manage')}
          variant="outline"
          width="full"
          onPress={() => {
            Linking.openURL(manageUrl).catch(() => undefined);
          }}
        />
      ) : null}
      <TextButton
        label={t('premium.reset')}
        tone="danger"
        disabled={busy}
        onPress={() => openDialog('reset')}
      />
    </View>
  );

  const renderPhase = () => {
    switch (view.phase) {
      case 'loading':
        return (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color={theme.colors.accent.primary} />
            <Text
              style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
            >
              {t('premium.loading')}
            </Text>
          </View>
        );
      case 'not_subscribed':
      case 'revoked':
        return renderNotSubscribed();
      case 'active':
      case 'exhausted':
        return renderUsable();
      case 'removed':
        return view.canRestore ? renderRestore('accent') : null;
      default:
        return null;
    }
  };

  const dialogCopy =
    dialog === 'consent'
      ? {
          title: t('premium.consent.title'),
          message: t('premium.consent.body'),
          confirm: t('premium.consent.confirm'),
          cancel: t('premium.consent.cancel'),
          onConfirm: confirmConsent,
          variant: 'primary' as const,
        }
      : {
          title: t('premium.resetTitle'),
          message: t('premium.resetBody'),
          confirm: t('premium.resetConfirm'),
          cancel: t('common.cancel'),
          onConfirm: confirmReset,
          variant: 'destructive' as const,
        };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('premium.title')}>
      <View className="gap-6 px-5 pb-6 pt-3">
        <Text
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
        >
          {t('premium.benefit')}
        </Text>

        {renderNotice()}

        {renderPhase()}

        <View className="gap-2">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('premium.renewalDisclosure')}
          </Text>
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('premium.devicesNote')}
          </Text>
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('premium.platformsNote')}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            <TextButton
              label={t('premium.terms')}
              onPress={() => {
                Linking.openURL(PREMIUM_TERMS_URL).catch(() => undefined);
              }}
            />
            <TextButton
              label={t('premium.privacy')}
              onPress={() => {
                Linking.openURL(PREMIUM_PRIVACY_URL).catch(() => undefined);
              }}
            />
          </View>
        </View>

        <ConfirmationModal
          visible={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onConfirm={dialogCopy.onConfirm}
          title={dialogCopy.title}
          message={dialogCopy.message}
          confirmLabel={dialogCopy.confirm}
          cancelLabel={dialogCopy.cancel}
          variant={dialogCopy.variant}
        />
      </View>
    </FullScreenModal>
  );
}
