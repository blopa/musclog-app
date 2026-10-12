import { Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { LogCardioModal } from '@/components/modals/LogCardioModal';
import { WorkoutSettingsModal } from '@/components/modals/WorkoutSettingsModal';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { PageIndicators } from '@/components/theme/PageIndicators';
import { TextButton } from '@/components/theme/TextButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { useWhatsNewChoiceValues } from '@/hooks/useWhatsNewChoiceValues';
import {
  WHATS_NEW_ACTION_CATALOG,
  type WhatsNewAction,
  type WhatsNewModalAction,
  type WhatsNewRoute,
} from '@/utils/whatsNew/catalog';
import type { WhatsNewFlow } from '@/utils/whatsNew/flow';

import { WhatsNewBlockView } from './WhatsNewBlockView';

type Props = {
  visible: boolean;
  flow: WhatsNewFlow;
  mode: 'upgrade' | 'replay';
  onDismiss: () => void | Promise<void>;
  onNavigate: (route: WhatsNewRoute) => void;
};

function unhandledModalAction(action: never): never {
  throw new Error(`Missing What's new modal: ${action}`);
}

export function WhatsNewModal({ visible, flow, mode, onDismiss, onNavigate }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const [pageIndex, setPageIndex] = useSubModalState(visible, 0);
  const [activeAction, setActiveAction] = useSubModalState<WhatsNewModalAction | null>(
    visible,
    null
  );
  const [closing, setClosing] = useState(false);
  const [closeFailed, setCloseFailed] = useSubModalState(visible, false);
  const closingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const choices = useWhatsNewChoiceValues(visible && activeAction === null);
  const busy = closing || Object.values(choices.saving).some(Boolean);
  const total = flow.pages.length + 1;
  const pageLabel = t('whatsNew.pageOf', {
    current: formatInteger(pageIndex + 1),
    total: formatInteger(total),
  });

  useEffect(() => {
    if (visible) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      AccessibilityInfo.announceForAccessibility(pageLabel);
    }
  }, [visible, pageIndex, pageLabel]);

  const dismiss = async (route?: WhatsNewRoute) => {
    if (closingRef.current || busy || activeAction !== null) {
      return;
    }
    closingRef.current = true;
    setClosing(true);
    setCloseFailed(false);
    try {
      await onDismiss();
      if (route) {
        onNavigate(route);
      }
    } catch {
      setCloseFailed(true);
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  };
  const action = (key: WhatsNewAction) => {
    const spec = WHATS_NEW_ACTION_CATALOG[key];
    if (spec.kind === 'route') {
      void dismiss(spec.route);
    } else {
      setActiveAction(key as WhatsNewModalAction);
    }
  };
  const page = flow.pages[pageIndex - 1];

  return (
    <FullScreenModal
      visible={visible}
      onClose={() => void dismiss()}
      title={t('whatsNew.title')}
      closable={activeAction === null}
      showHeader={false}
      scrollable={false}
    >
      <View className="flex-row items-center justify-between border-b border-border-light px-4 py-2">
        <Text accessibilityRole="header" className="text-lg font-bold text-text-primary">
          {t('whatsNew.title')}
        </Text>
        <IconButton
          icon={X}
          accessibilityLabel={t('whatsNew.skip')}
          variant="ghost"
          disabled={busy}
          onPress={() => void dismiss()}
        />
      </View>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: theme.spacing.padding.lg, gap: theme.spacing.gap.xl }}
      >
        {pageIndex === 0 ? (
          <View className="gap-6 py-6">
            <Sparkles size={theme.iconSize['2xl']} color={theme.colors.accent.primary} />
            <Text accessibilityRole="header" className="text-2xl font-bold text-text-primary">
              {t('whatsNew.intro.title')}
            </Text>
            <Text className="text-base leading-6 text-text-secondary">
              {t('whatsNew.intro.description')}
            </Text>
            {mode === 'upgrade' && flow.truncated ? (
              <Text className="text-sm text-text-secondary">{t('whatsNew.intro.truncated')}</Text>
            ) : null}
          </View>
        ) : page ? (
          page.blocks.map((block) => (
            <WhatsNewBlockView
              key={`${page.key}:${block.id}`}
              block={block}
              choices={choices}
              onAction={action}
              disabled={busy}
            />
          ))
        ) : null}
      </ScrollView>
      <View className="gap-4 border-t border-border-light bg-bg-primary px-4 py-4">
        {closeFailed ? (
          <Text accessibilityRole="alert" className="text-sm text-status-error">
            {t('whatsNew.dismissFailed')}
          </Text>
        ) : null}
        <View accessible accessibilityLabel={pageLabel}>
          <PageIndicators totalPages={total} currentPage={pageIndex} />
        </View>
        <View className="flex-row gap-3">
          {pageIndex > 0 ? (
            <Button
              width="flex-1"
              variant="outline"
              label={t('whatsNew.back')}
              disabled={busy}
              onPress={() => setPageIndex((index) => index - 1)}
            />
          ) : null}
          <Button
            width="flex-1"
            label={t(pageIndex === total - 1 ? 'whatsNew.done' : 'whatsNew.next')}
            disabled={busy}
            loading={closing}
            onPress={() =>
              pageIndex === total - 1 ? void dismiss() : setPageIndex((index) => index + 1)
            }
          />
        </View>
        {pageIndex === 0 ? (
          <TextButton label={t('whatsNew.skip')} disabled={busy} onPress={() => void dismiss()} />
        ) : null}
      </View>
      {activeAction === 'openWorkoutSettings' ? (
        <WorkoutSettingsModal visible={visible} onClose={() => setActiveAction(null)} />
      ) : activeAction === 'openCardioLog' ? (
        <LogCardioModal visible={visible} onClose={() => setActiveAction(null)} />
      ) : activeAction === null ? null : (
        unhandledModalAction(activeAction)
      )}
    </FullScreenModal>
  );
}
