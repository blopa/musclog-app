import { format, getWeek } from 'date-fns';
import { Calendar, ChevronRight, History } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { CheckinDetailsModal } from '../../components/modals/CheckinDetailsModal';
import { SelectModal } from '../../components/modals/SelectModal';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useDateFnsLocale } from '../../hooks/useDateFnsLocale';
import { useNutritionCheckins } from '../../hooks/useNutritionCheckins';
import { useTheme } from '../../hooks/useTheme';

export default function CheckinListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const { goal: currentGoal } = useCurrentNutritionGoal();
  const { checkins } = useNutritionCheckins({
    nutritionGoalId: currentGoal?.id,
  });

  const [selectedCheckinId, setSelectedCheckinId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isYearModalVisible, setIsYearModalVisible] = useState(false);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 100;
    const list = [];
    for (let y = currentYear; y >= startYear; y--) {
      list.push({ label: y.toString(), value: y.toString() });
    }

    return list;
  }, []);

  const { milestones, history } = useMemo(() => {
    const m: typeof checkins = [];
    const h: typeof checkins = [];

    checkins.forEach((c) => {
      if (c.status === 'pending') {
        m.push(c);
      } else {
        const year = new Date(c.checkinDate).getFullYear().toString();
        if (year === selectedYear) {
          h.push(c);
        }
      }
    });

    return { milestones: m.slice(0, 1), history: h.sort((a, b) => b.checkinDate - a.checkinDate) };
  }, [checkins, selectedYear]);

  const renderStatusBadge = (status: string) => {
    let color = theme.colors.text.tertiary;
    let label = t('nutrition.checkin.status.pending');

    switch (status) {
      case 'ahead':
        color = theme.colors.status.info;
        label = t('nutrition.checkin.status.ahead');
        break;
      case 'onTrack':
        color = theme.colors.status.emerald;
        label = t('nutrition.checkin.status.onTrack');
        break;
      case 'behind':
        color = theme.colors.status.warning;
        label = t('nutrition.checkin.status.behind');
        break;
    }

    return (
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}20` }}>
        <Text className="text-[10px] font-bold uppercase" style={{ color }}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <MasterLayout>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.spacing.margin.lg }}>
        <Text className="mb-6 text-3xl font-bold text-text-primary">
          {t('nutrition.checkin.title')}
        </Text>

        {/* Next Milestones */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center gap-2">
            <Calendar size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {t('nutrition.checkin.nextMilestones')}
            </Text>
          </View>

          {milestones.length > 0 ? (
            milestones.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCheckinId(c.id)}
                className="overflow-hidden rounded-2xl bg-bg-card shadow-sm"
              >
                <View className="flex-row items-center justify-between p-4">
                  <View className="min-w-0 flex-1">
                    <Text className="mb-1 text-lg font-bold text-text-primary">
                      {t('nutrition.checkin.weekTitle', { number: getWeek(c.checkinDate) })}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {format(c.checkinDate, 'MMM d, yyyy', { locale: dateFnsLocale })}
                    </Text>
                  </View>
                  <View className="shrink-0 flex-row items-center gap-3 pl-2">
                    <View className="rounded-full bg-accent-primary px-4 py-2">
                      <Text className="text-sm font-bold text-bg-primary">
                        {t('nutrition.checkin.prepareNow')}
                      </Text>
                    </View>
                    <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View className="items-center justify-center rounded-2xl border border-dashed border-border-dark bg-bg-card p-8">
              <Text className="text-center text-text-secondary">
                {t('nutrition.checkin.noMilestones')}
              </Text>
            </View>
          )}
        </View>

        {/* History */}
        <View>
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <History size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {t('nutrition.checkin.history')}
              </Text>
            </View>
            <Pressable
              onPress={() => setIsYearModalVisible(true)}
              className="rounded-full bg-bg-overlay px-3 py-1"
            >
              <Text className="text-xs font-bold text-text-primary">{selectedYear}</Text>
            </Pressable>
          </View>

          <View className="gap-3">
            {history.length > 0 ? (
              history.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCheckinId(c.id)}
                  className="overflow-hidden rounded-2xl bg-bg-card"
                >
                  <View className="flex-row items-center justify-between p-4">
                    <View className="min-w-0 flex-1">
                      <Text className="mb-1 font-bold text-text-primary">
                        {t('nutrition.checkin.weekTitle', { number: getWeek(c.checkinDate) })}
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        {format(c.checkinDate, 'MMM d, yyyy', { locale: dateFnsLocale })}
                      </Text>
                    </View>
                    <View className="shrink-0 flex-row items-center gap-2 pl-2">
                      {renderStatusBadge(c.status ?? 'pending')}
                      <ChevronRight size={theme.iconSize.xs} color={theme.colors.text.tertiary} />
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="text-text-tertiary">{t('nutrition.checkin.noHistory')}</Text>
              </View>
            )}
          </View>
        </View>

        <View className="h-20" />
      </ScrollView>

      <CheckinDetailsModal
        checkinId={selectedCheckinId}
        visible={!!selectedCheckinId}
        onClose={() => setSelectedCheckinId(null)}
      />

      <SelectModal
        visible={isYearModalVisible}
        onClose={() => setIsYearModalVisible(false)}
        title={t('nutrition.checkin.selectYear')}
        options={years}
        selectedValue={selectedYear}
        onSelect={(val: string) => {
          setSelectedYear(val);
          setIsYearModalVisible(false);
        }}
      />
    </MasterLayout>
  );
}
