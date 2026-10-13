import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { TextButton } from '@/components/theme/TextButton';
import { type InsightSessions, useCycleInsights } from '@/hooks/useCycleInsights';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { Insight } from '@/utils/cycle/cycleInsights';

import { insightSentence } from './insightCopy';

const MAX_SHOWN = 3;

/**
 * What the person's own records show, as observations: how many of how many cycles, the days
 * behind it, and a plain note that it comes only from their log. Nothing here says a phase caused
 * anything, and nothing appears until there are at least three cycles to compare.
 */
export function CycleInsightsCard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { insights, sessions } = useCycleInsights();
  const [open, setOpen] = useState<Insight | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);

  if (insights.length === 0) {
    return null;
  }

  const sentence = (insight: Insight) => insightSentence(t, insight, formatInteger);

  return (
    <View className="mb-6 rounded-2xl border-2 border-ink/5 bg-bg-overlay p-5">
      <View className="mb-3 flex-row items-center gap-2">
        <Sparkles size={18} color={theme.colors.accent.primary} />
        <Text className="text-base font-bold text-text-primary">{t('cycle.insights.title')}</Text>
      </View>
      <View className="gap-4">
        {insights.slice(0, MAX_SHOWN).map((insight) => (
          <View key={insight.id} className="gap-1">
            <Text className="text-sm text-text-primary">{sentence(insight)}</Text>
            <Text className="text-xs text-text-tertiary">{t('cycle.insights.basedOnRecords')}</Text>
            <TextButton
              label={
                insight.kind === 'workout_near_start'
                  ? t('cycle.insights.viewSessions')
                  : t('cycle.insights.viewData')
              }
              onPress={() => setOpen(insight)}
            />
          </View>
        ))}
      </View>

      <BottomPopUp
        visible={open != null}
        onClose={() => setOpen(null)}
        title={t('cycle.insights.evidenceTitle')}
      >
        {open ? (
          <EvidenceList insight={open} sessions={sessions} date={date} sentence={sentence(open)} />
        ) : null}
      </BottomPopUp>
    </View>
  );
}

function EvidenceList({
  insight,
  sessions,
  date,
  sentence,
}: {
  insight: Insight;
  sessions: InsightSessions;
  date: (ms: number) => string;
  sentence: string;
}) {
  const { t } = useTranslation();
  const days = [...new Set(insight.evidence.days)].sort((a, b) => a - b);

  return (
    <View className="gap-3 pb-4">
      <Text className="text-sm text-text-secondary">{sentence}</Text>
      {insight.evidence.workoutIds.map((id) => (
        <View key={id} className="rounded-xl bg-bg-card p-3">
          <Text className="text-sm font-bold text-text-primary">{sessions[id]?.name ?? id}</Text>
          {sessions[id] ? (
            <Text className="text-xs text-text-tertiary">{date(sessions[id].date)}</Text>
          ) : null}
        </View>
      ))}
      {insight.evidence.workoutIds.length === 0
        ? days.map((day) => (
            <View key={day} className="rounded-xl bg-bg-card p-3">
              <Text className="text-sm font-bold text-text-primary">{date(day)}</Text>
            </View>
          ))
        : null}
      <Text className="text-xs text-text-tertiary">{t('cycle.insights.basedOnRecords')}</Text>
    </View>
  );
}
