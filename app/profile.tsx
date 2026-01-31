import { useRouter } from 'expo-router';
import { CheckCircle, Dumbbell, Edit, List, Settings, TrendingUp, User } from 'lucide-react-native';
import { createElement, lazy, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { StatCard } from '../components/cards/StatCard';
import { ManagementItem } from '../components/ManagementItem';
import { MasterLayout } from '../components/MasterLayout';
import BodyMetricsHistoryModal from '../components/modals/BodyMetricsHistoryModal';
import ShowMoreButton from '../components/ShowMoreButton';
import { useSettings } from '../hooks/useSettings';
import { useUser } from '../hooks/useUser';
import { useUserMetrics } from '../hooks/useUserMetrics';
import { theme } from '../theme';
import { getAvatarDisplayProps } from '../utils/avatarUtils';
const ProgressIndicator = lazy(() =>
  import('../components/theme/ProgressIndicator').then(({ ProgressIndicator }) => ({
    default: ProgressIndicator,
  }))
);

const PROFILE_DATA = {
  user: {
    name: 'Alex Johnson',
    avatar: require('../assets/icon.png'),
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

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { weightUnit, heightUnit } = useSettings();
  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const { metrics, isLoading: isLoadingMetrics } = useUserMetrics();
  const { management } = PROFILE_DATA;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBodyMetricsHistoryVisible, setIsBodyMetricsHistoryVisible] = useState(false);

  // Transform metrics and user data into stats array format
  const stats = useMemo(() => {
    const statsArray: {
      id: string;
      titleKey: string;
      value: string;
      unit?: string;
      change?: string;
      changeType?: 'positive' | 'negative' | 'warning';
      status?: string;
      statusColor?: string;
      icon: typeof TrendingUp | typeof CheckCircle | typeof User;
      iconColor: string;
    }[] = [];

    // Weight stat
    if (metrics?.weight !== undefined) {
      statsArray.push({
        id: 'weight',
        titleKey: 'profile.stats.weight',
        value: metrics.weight.toFixed(1),
        unit: weightUnit,
        icon: TrendingUp,
        iconColor: theme.colors.accent.primary,
      });
    }

    // Height stat
    if (metrics?.height !== undefined) {
      statsArray.push({
        id: 'height',
        titleKey: 'profile.stats.height',
        value: metrics.height.toFixed(0),
        unit: heightUnit,
        status: 'Verified',
        icon: CheckCircle,
        iconColor: theme.colors.text.secondary,
      });
    }

    // Body fat stat
    if (metrics?.bodyFat !== undefined) {
      statsArray.push({
        id: 'bodyFat',
        titleKey: 'profile.stats.bodyFat',
        value: metrics.bodyFat.toFixed(1),
        unit: '%',
        icon: TrendingUp,
        iconColor: theme.colors.status.warning,
      });
    }

    // BMI stat
    if (metrics?.bmi !== undefined) {
      const bmiStatus =
        metrics.bmi < 18.5
          ? 'Underweight'
          : metrics.bmi < 25
            ? 'Normal'
            : metrics.bmi < 30
              ? 'Overweight'
              : 'Obese';
      statsArray.push({
        id: 'bmi',
        titleKey: 'profile.stats.bmi',
        value: metrics.bmi.toFixed(1),
        status: bmiStatus,
        statusColor: theme.colors.status.info,
        icon: User,
        iconColor: theme.colors.status.info,
      });
    }

    // Age stat (from user)
    if (dbUser) {
      statsArray.push({
        id: 'age',
        titleKey: 'profile.stats.age',
        value: dbUser.getAge().toString(),
        icon: User,
        iconColor: theme.colors.text.secondary,
      });
    }

    // Gender stat (from user)
    if (dbUser) {
      const genderLabel =
        dbUser.gender === 'male' ? 'Male' : dbUser.gender === 'female' ? 'Female' : 'Other';
      statsArray.push({
        id: 'gender',
        titleKey: 'profile.stats.gender',
        value: genderLabel,
        icon: User,
        iconColor: theme.colors.text.secondary,
      });
    }

    return statsArray;
  }, [metrics, dbUser, weightUnit, heightUnit]);

  const getStatUnit = (stat: (typeof stats)[0]) => {
    if (stat.id === 'weight') return weightUnit;
    if (stat.id === 'height') return heightUnit;
    return stat.unit;
  };

  // Simulate syncing with HealthKit or external services
  const syncData = async () => {
    setIsSyncing(true);
    try {
      // Simulate sync operation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // In real app: await syncWithHealthKit();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Syncing Indicator */}
        {isSyncing ? (
          <View className="px-6 pt-6">
            <ProgressIndicator message={t('profile.syncing.healthKit')} />
          </View>
        ) : null}
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <Text className="text-4xl font-bold text-text-primary">{t('profile.header.title')}</Text>
          <Pressable
            className="active:bg-bg-card-elevated h-12 w-12 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.push('/settings')}
          >
            <Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* User Profile Section */}
        <View className="mb-8 items-center">
          <View className="relative mb-4">
            <View
              className="h-32 w-32 overflow-hidden rounded-full border-4"
              style={{
                borderColor: dbUser
                  ? getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).color
                  : theme.colors.accent.primary,
                backgroundColor: dbUser
                  ? getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).backgroundColor
                  : theme.colors.accent.primary20,
              }}
            >
              {dbUser?.avatarIcon ? (
                <View className="h-full w-full items-center justify-center rounded-full">
                  {createElement(
                    getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).IconComponent,
                    {
                      size: 40,
                      color: getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).color,
                    }
                  )}
                </View>
              ) : (
                <Image
                  source={PROFILE_DATA.user.avatar}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              )}
            </View>
            <Pressable
              className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-2 border-bg-primary"
              style={{ backgroundColor: theme.colors.accent.primary }}
            >
              <Edit size={theme.iconSize.sm} color={theme.colors.text.black} />
            </Pressable>
          </View>
          <Text className="mb-3 text-3xl font-bold text-text-primary">
            {dbUser?.fullName || PROFILE_DATA.user.name}
          </Text>
          {dbUser?.fitnessGoal ? (
            <Text className="text-base text-text-primary">
              {t('profile.goal')}: {dbUser.fitnessGoal}
            </Text>
          ) : null}
        </View>

        {/* Current Stats Section */}
        <View className="mb-8 px-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('profile.currentStats')}
            </Text>
            <ShowMoreButton
              onPress={() => setIsBodyMetricsHistoryVisible(true)}
              label={t('profile.history')}
            />
          </View>
          <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.md }}>
            {stats.map((stat) => (
              <View key={stat.id} style={{ width: '31%' }}>
                <StatCard
                  title={t(stat.titleKey)}
                  value={stat.value}
                  unit={getStatUnit(stat)}
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

      <BodyMetricsHistoryModal
        visible={isBodyMetricsHistoryVisible}
        onClose={() => setIsBodyMetricsHistoryVisible(false)}
      />
    </MasterLayout>
  );
}
