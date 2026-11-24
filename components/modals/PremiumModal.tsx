import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import {
  PREMIUM_NOTICES,
  premiumNoticeCopy,
  type PremiumNoticeTone,
} from '@/components/premium/premiumNotices';
import {
  PremiumBenefitList,
  PremiumComparison,
  PremiumPaywallHero,
} from '@/components/premium/PremiumPaywall';
import { formatRenewalDate, PremiumUsageBar } from '@/components/premium/PremiumUsageBar';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { AI_GATEWAY_LINKS } from '@/constants/aiGatewayLinks';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { usePremium } from '@/hooks/usePremium';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import {
  busyLineFor,
  dismissPremiumActionFailure,
  getPremiumConsentPending,
  type PremiumBusyLine,
  subscribePremiumActivity,
  takePremiumConsentPending,
} from '@/utils/premium/premiumActivity';
import {
  manageSubscriptionUrl,
  PREMIUM_PRIVACY_PATH,
  PREMIUM_TERMS_PATH,
} from '@/utils/premium/premiumLinks';
import { websitePageUrl } from '@/utils/websiteUrl';

/** One whole key per busy line (stage of a purchase, reset, switch), so the translation check sees each. */
export const PREMIUM_BUSY_KEYS: Record<PremiumBusyLine, string> = {
  store: 'premium.progress.store',
  confirming: 'premium.progress.confirming',
  slow: 'premium.progress.slow',
  reset: 'premium.progress.reset',
  toggle: 'premium.progress.toggle',
};

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
  const premium = usePremium({ load: visible });
  const { view, busy, activity, consentNeeded } = premium;
  const busyLine = busyLineFor(activity);
  const consentPending = useSyncExternalStore(
    subscribePremiumActivity,
    getPremiumConsentPending,
    getPremiumConsentPending
  );
  const locale = i18n.resolvedLanguage ?? i18n.language;
  // One ConfirmationModal serves both questions: two siblings would hit the iOS presenter bug.
  const [dialogOpen, setDialogOpen] = useSubModalVisibility(visible);
  const [dialog, setDialog] = useState<PremiumDialog>('consent');
  const renewal = formatRenewalDate(view.resetsAt, locale);
  const manageUrl = manageSubscriptionUrl(Platform.OS);

  // A failure belongs to the screen it was shown on: closing it forgets it, so the next open starts
  // clean (one that landed while closed is shown on the next open).
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    return dismissPremiumActionFailure;
  }, [visible]);

  const openDialog = (next: PremiumDialog) => {
    setDialog(next);
    setDialogOpen(true);
  };

  // A purchase or restore that succeeded still needs the consent before the switch can turn on. The
  // question is pending in a store, so it is asked even when the modal was closed while it finished.
  useEffect(() => {
    if (!visible || !consentPending || busy) {
      return;
    }

    let cancelled = false;

    // Deferred a tick so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      if (cancelled || !takePremiumConsentPending()) {
        return;
      }

      if (consentNeeded(true)) {
        setDialog('consent');
        setDialogOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible, consentPending, busy, consentNeeded, setDialogOpen]);

  const isActing = (kind: 'subscribe' | 'restore') => activity?.kind === kind;

  const handleToggle = async (on: boolean) => {
    if (consentNeeded(on)) {
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
  const noticeTone = notice ? PREMIUM_NOTICES[notice].tone : null;
  const noticeColor = toneColor(noticeTone, theme);

  const renderNotice = () => {
    if (!notice) {
      return null;
    }

    const { key, params } = premiumNoticeCopy(notice, renewal);
    const text = t(key, params);

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

  /** A polite status line with a spinner; never a countdown or a percentage. */
  const renderBusyLine = () => {
    if (!busyLine) {
      return null;
    }

    return (
      <View
        className="flex-row items-center gap-3"
        role="status"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={theme.colors.accent.primary} />
        <Text
          className="min-w-0 flex-1"
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
        >
          {t(PREMIUM_BUSY_KEYS[busyLine])}
        </Text>
      </View>
    );
  };

  /** On the paywall the wait is a centered loader over a dim layer, not a line squeezed above the button. */
  const renderBusyOverlay = () => {
    if (!busyLine) {
      return null;
    }

    return (
      <View
        className="items-center gap-3 rounded-card px-6 py-5"
        role="status"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{ backgroundColor: theme.colors.background.card }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        <Text
          className="text-center"
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.sm }}
        >
          {t(PREMIUM_BUSY_KEYS[busyLine])}
        </Text>
      </View>
    );
  };

  const renderRestore = (variant: 'outline' | 'accent') => (
    <Button
      label={t('premium.restore')}
      variant={variant}
      width="full"
      disabled={busy}
      loading={busy ? isActing('restore') : undefined}
      onPress={() => {
        premium.restore();
      }}
    />
  );

  /**
   * The paywall's pinned footer: the store's price, the one filled button and a quiet Restore.
   * The button names the price, so what a tap costs is never only in the small print (3.1.2(c)).
   */
  const renderPaywallFooter = () => {
    if (!view.canSubscribe && !view.canRestore) {
      return null;
    }

    // Beside Subscribe, Restore is a quiet link; on its own it is the screen's one button.
    let restoreAction: ReactNode = null;

    if (view.canRestore && view.canSubscribe) {
      restoreAction = (
        <TextButton
          label={t('premium.restore')}
          align="center"
          disabled={busy}
          onPress={() => {
            premium.restore();
          }}
        />
      );
    } else if (view.canRestore) {
      restoreAction = renderRestore('accent');
    }

    return (
      <View className="gap-2">
        {view.canSubscribe ? (
          <>
            <Button
              label={
                premium.priceString
                  ? t('premium.paywall.cta', { price: premium.priceString })
                  : t('premium.subscribe')
              }
              variant="accent"
              size="lg"
              width="full"
              disabled={busy}
              loading={busy ? isActing('subscribe') : undefined}
              onPress={() => {
                premium.subscribe();
              }}
            />
            <Text
              className="text-center"
              style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}
            >
              {t('premium.paywall.reassurance')}
            </Text>
          </>
        ) : null}
        {restoreAction}
      </View>
    );
  };

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
      {renderBusyLine()}
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
        return (
          <View className="gap-8">
            <PremiumBenefitList />
            <PremiumComparison priceString={premium.priceString} />
          </View>
        );
      case 'active':
      case 'exhausted':
        return renderUsable();
      case 'removed':
        return (
          <View className="gap-4">
            {renderBusyLine()}
            {view.canRestore ? renderRestore('accent') : null}
          </View>
        );
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

  const isPaywall = view.phase === 'not_subscribed' || view.phase === 'revoked';

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('premium.title')}
      footer={isPaywall ? renderPaywallFooter() : undefined}
      scrollCue={isPaywall}
      overlay={isPaywall ? renderBusyOverlay() : undefined}
    >
      <View className="gap-6 px-5 pb-6 pt-3">
        {isPaywall ? (
          <PremiumPaywallHero />
        ) : (
          <Text
            style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
          >
            {t('premium.benefit')}
          </Text>
        )}

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
                Linking.openURL(websitePageUrl(PREMIUM_TERMS_PATH, locale)).catch(() => undefined);
              }}
            />
            <TextButton
              label={t('premium.privacy')}
              onPress={() => {
                Linking.openURL(websitePageUrl(PREMIUM_PRIVACY_PATH, locale)).catch(
                  () => undefined
                );
              }}
            />
          </View>
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('common.aiGateways.intro')}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {AI_GATEWAY_LINKS.map((link) => (
              <TextButton
                key={link.id}
                label={t(link.labelKey)}
                onPress={() => {
                  Linking.openURL(link.url).catch(() => undefined);
                }}
              />
            ))}
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
          // The consent text is long and longer still in other languages: on a small screen the body
          // scrolls and the buttons stay on screen.
          scrollable
        />
      </View>
    </FullScreenModal>
  );
}
