import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { ComponentType } from 'react';
import { Text, View } from 'react-native';

import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type HistoryEntry = {
  id: string;
  date: string;
  value: string;
  change: string | null;
  changeType: 'down' | 'up' | null;
  note: string;
  icon: ComponentType<{ size: number; color: string }>;
  iconColor: string;
  iconBg: string;
  opacity?: number;
};

// History Entry Card Component
export function HistoryBodyMetricCard({ entry }: { entry: HistoryEntry }) {
  const IconComponent = entry.icon;

  return (
    <View style={{ opacity: entry.opacity || 1 }}>
      <GenericCard variant="card" size="default">
        <View className="flex-row items-center justify-between p-5">
          <View className="flex-1 flex-row items-center gap-4">
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: entry.iconBg }}
            >
              <IconComponent size={theme.iconSize.xl} color={entry.iconColor} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-text-secondary">{entry.date}</Text>
              <Text className="text-xl font-extrabold tracking-tight text-text-primary">
                {entry.value}
              </Text>
            </View>
          </View>
          <View className="items-end gap-1">
            {entry.change ? (
              <View
                className="flex-row items-center rounded-full px-2.5 py-1"
                style={{
                  backgroundColor:
                    entry.changeType === 'down'
                      ? theme.colors.accent.primary20
                      : theme.colors.status.warning10,
                }}
              >
                {entry.changeType === 'down' ? (
                  <TrendingDown size={14} color={theme.colors.accent.primary} />
                ) : (
                  <TrendingUp size={14} color={theme.colors.status.warning} />
                )}
                <Text
                  className="ml-1 text-xs font-bold"
                  style={{
                    color:
                      entry.changeType === 'down'
                        ? theme.colors.accent.primary
                        : theme.colors.status.warning,
                  }}
                >
                  {entry.change}
                </Text>
              </View>
            ) : null}
            {!entry.change ? (
              <View
                className="flex-row items-center rounded-full px-2.5 py-1"
                style={{ backgroundColor: theme.colors.status.gray10 }}
              >
                <Text className="text-xs font-bold text-text-tertiary">{entry.note}</Text>
              </View>
            ) : null}
            <Text className="text-[10px] font-medium text-text-tertiary">{entry.note}</Text>
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
