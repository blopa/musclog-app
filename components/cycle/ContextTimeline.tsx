import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { CycleContextDto } from '@/utils/cycle/types';

import { contraceptionTitleKey, lifeStageTitleKey } from './ContextFields';

type ContextTimelineProps = {
  contexts: CycleContextDto[];
  onEdit: (context: CycleContextDto) => void;
};

/** The history of life-stage and contraception changes, newest first. Tap one to edit it. */
export function ContextTimeline({ contexts, onEdit }: ContextTimelineProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);

  if (contexts.length === 0) {
    return null;
  }

  return (
    <View className="mt-6 gap-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
        {t('cycle.context.timelineTitle')}
      </Text>
      {[...contexts]
        .sort((a, b) => b.effectiveFrom - a.effectiveFrom)
        .map((context) => (
          <Pressable
            key={context.id}
            onPress={() => onEdit(context)}
            accessibilityRole="button"
            className="rounded-2xl border-2 border-ink/5 bg-bg-card p-4"
          >
            <Text className="text-xs text-text-tertiary">
              {t('cycle.context.from', { date: date(context.effectiveFrom) })}
            </Text>
            <Text className="text-sm font-bold text-text-primary">
              {t(lifeStageTitleKey(context.lifeStage))}
            </Text>
            <Text className="text-sm text-text-secondary">
              {t(contraceptionTitleKey(context.contraception))}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}
