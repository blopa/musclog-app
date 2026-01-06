import React from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import {
  Settings,
  Edit,
  TrendingUp,
  CheckCircle,
  User,
  Dumbbell,
  List,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';

const PROFILE_DATA = {
  user: {
    name: 'Alex Johnson',
    avatar: require('../assets/icon.png'),
    membership: 'ELITE MEMBER',
    goal: 'Muscle Gain',
  },
  stats: [
    {
      id: 'weight',
      titleKey: 'profile.stats.weight',
      value: '78.5',
      unit: 'kg',
      change: '+1.2%',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: theme.colors.accent.primary,
    },
    {
      id: 'height',
      titleKey: 'profile.stats.height',
      value: '180',
      unit: 'cm',
      status: 'Verified',
      icon: CheckCircle,
      iconColor: theme.colors.text.secondary,
    },
    {
      id: 'bodyFat',
      titleKey: 'profile.stats.bodyFat',
      value: '15',
      unit: '%',
      change: '+0.5%',
      changeType: 'warning' as const,
      icon: TrendingUp,
      iconColor: theme.colors.status.warning,
    },
    {
      id: 'bmi',
      titleKey: 'profile.stats.bmi',
      value: '24.2',
      status: 'Normal',
      statusColor: theme.colors.status.info,
      icon: User,
      iconColor: theme.colors.status.info,
    },
    {
      id: 'age',
      titleKey: 'profile.stats.age',
      value: '26',
      icon: User,
      iconColor: theme.colors.text.secondary,
    },
    {
      id: 'gender',
      titleKey: 'profile.stats.gender',
      value: 'Male',
      icon: User,
      iconColor: theme.colors.text.secondary,
    },
  ],
  management: [
    {
      id: 'personal',
      titleKey: 'profile.managementItems.editPersonal',
      descriptionKey: 'profile.managementItems.editPersonalDesc',
      icon: User,
      iconColor: theme.colors.accent.primary,
    },
    {
      id: 'fitness',
      titleKey: 'profile.managementItems.editFitness',
      descriptionKey: 'profile.managementItems.editFitnessDesc',
      icon: Dumbbell,
      iconColor: theme.colors.status.purple,
    },
    {
      id: 'preferences',
      titleKey: 'profile.managementItems.appPreferences',
      descriptionKey: 'profile.managementItems.appPreferencesDesc',
      icon: List,
      iconColor: theme.colors.text.secondary,
    },
  ],
};

type StatCardProps = {
  title: string | React.ReactNode;
  value: string;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'warning';
  status?: string;
  statusColor?: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
};

function StatCard({
  title,
  value,
  unit,
  change,
  changeType,
  icon: Icon,
  iconColor,
}: StatCardProps) {
  return (
    <View className="rounded-2xl border border-border-default bg-bg-overlay p-4">
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="text-sm text-text-secondary">{title}</Text>
        <Icon size={theme.iconSize.sm} color={iconColor} />
      </View>
      <View className="mb-1 flex-row items-baseline gap-1">
        <Text className="text-3xl font-bold text-text-primary">{value}</Text>
        {unit && <Text className="text-lg text-text-secondary">{unit}</Text>}
      </View>
      {change && (
        <View className="flex-row items-center gap-1">
          <TrendingUp
            size={theme.iconSize.xs}
            color={
              changeType === 'positive' ? theme.colors.accent.primary : theme.colors.status.warning
            }
          />
          <Text
            className="text-xs font-medium"
            style={{
              color:
                changeType === 'positive'
                  ? theme.colors.accent.primary
                  : theme.colors.status.warning,
            }}>
            {change}
          </Text>
        </View>
      )}
    </View>
  );
}

type ManagementItemProps = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  onPress?: () => void;
};

function ManagementItem({
  title,
  description,
  icon: Icon,
  iconColor,
  onPress,
}: ManagementItemProps) {
  return (
    <Pressable
      className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl border border-border-default bg-bg-overlay p-4"
      onPress={onPress}>
      <View
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${iconColor}20` }}>
        <Icon size={theme.iconSize.md} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        <Text className="mt-0.5 text-sm text-text-secondary">{description}</Text>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, stats, management } = PROFILE_DATA;

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <Text className="text-4xl font-bold text-text-primary">{t('profile.header.title')}</Text>
          <Pressable
            className="active:bg-bg-card-elevated h-12 w-12 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.push('/settings')}>
            <Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* User Profile Section */}
        <View className="mb-8 items-center">
          <View className="relative mb-4">
            <View
              className="h-32 w-32 overflow-hidden rounded-full border-4"
              style={{ borderColor: theme.colors.accent.primary }}>
              <Image source={user.avatar} className="h-full w-full" resizeMode="cover" />
            </View>
            <Pressable
              className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-2 border-bg-primary"
              style={{ backgroundColor: theme.colors.accent.primary }}>
              <Edit size={theme.iconSize.sm} color={theme.colors.text.black} />
            </Pressable>
          </View>
          <Text className="mb-3 text-3xl font-bold text-text-primary">{user.name}</Text>
          <View className="flex-row items-center gap-3">
            <View className="bg-bg-card-elevated rounded-full px-4 py-1.5">
              <Text className="text-xs font-bold text-accent-primary">{user.membership}</Text>
            </View>
            <Text className="text-base text-text-primary">
              {t('profile.goal')}: {user.goal}
            </Text>
          </View>
        </View>

        {/* Current Stats Section */}
        <View className="mb-8 px-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('profile.currentStats')}
            </Text>
            <Pressable onPress={() => router.push('/stats-history')}>
              <Text className="text-sm font-semibold text-accent-primary">
                {t('profile.history')}
              </Text>
            </Pressable>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {stats.map((stat) => (
              <View key={stat.id} style={{ width: '31%' }}>
                <StatCard
                  title={t(stat.titleKey)}
                  value={stat.value}
                  unit={stat.unit}
                  change={stat.change}
                  changeType={stat.changeType}
                  icon={stat.icon}
                  iconColor={stat.iconColor}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Management Section */}
        <View className="mb-8 px-6">
          <Text className="mb-4 text-2xl font-bold text-text-primary">
            {t('profile.management')}
          </Text>
          <View className="gap-3">
            {management.map((item) => (
              <ManagementItem
                key={item.id}
                title={t(item.titleKey)}
                description={t(item.descriptionKey)}
                icon={item.icon}
                iconColor={item.iconColor}
                onPress={() => {
                  // Handle navigation based on item.id
                  if (item.id === 'personal') {
                    router.push('/profile/edit-personal');
                  } else if (item.id === 'fitness') {
                    router.push('/profile/edit-fitness');
                  } else if (item.id === 'preferences') {
                    router.push('/settings');
                  }
                }}
              />
            ))}
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>
    </MasterLayout>
  );
}
