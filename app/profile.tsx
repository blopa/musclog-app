import { useRouter } from 'expo-router';
import { CheckCircle, Dumbbell, Edit, List, Settings, TrendingUp, User } from 'lucide-react-native';
import { createElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { StatCard } from '../components/cards/StatCard';
import { type PersonalInfo } from '../components/EditPersonalInfoBody';
import { ManagementItem } from '../components/ManagementItem';
import { MasterLayout } from '../components/MasterLayout';
import BodyMetricsHistoryModal from '../components/modals/BodyMetricsHistoryModal';
import {
  EditFitnessDetailsModal,
  type FitnessDetails,
} from '../components/modals/EditFitnessDetailsModal';
import { EditPersonalInfoModal } from '../components/modals/EditPersonalInfoModal';
import ShowMoreButton from '../components/ShowMoreButton';
import { ProgressIndicator } from '../components/theme/ProgressIndicator';
import { type Gender } from '../database/models';
import { UserService } from '../database/services';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from '../hooks/useSettings';
import { useUser } from '../hooks/useUser';
import { useUserMetrics } from '../hooks/useUserMetrics';
import { theme } from '../theme';
import { getAvatarDisplayProps } from '../utils/avatarUtils';

const MANAGEMENT_ITEMS = [
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
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { units, weightUnit, heightUnit } = useSettings();
  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const { metrics, isLoading: isLoadingMetrics } = useUserMetrics();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBodyMetricsHistoryVisible, setIsBodyMetricsHistoryVisible] = useState(false);
  const [isEditPersonalVisible, setIsEditPersonalVisible] = useState(false);
  const [isEditFitnessVisible, setIsEditFitnessVisible] = useState(false);

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
      // TODO: properly implement BMI logic later
      // probably use the existing BMI logic from nutritionCalculator
      const bmiStatusKey =
        metrics.bmi < 18.5
          ? 'profile.bmiStatus.underweight'
          : metrics.bmi < 25
            ? 'profile.bmiStatus.normal'
            : metrics.bmi < 30
              ? 'profile.bmiStatus.overweight'
              : 'profile.bmiStatus.obese';
      statsArray.push({
        id: 'bmi',
        titleKey: 'profile.stats.bmi',
        value: metrics.bmi.toFixed(1),
        status: t(bmiStatusKey),
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
      const genderKey =
        dbUser.gender === 'male'
          ? 'profile.gender.male'
          : dbUser.gender === 'female'
            ? 'profile.gender.female'
            : 'profile.gender.other';
      statsArray.push({
        id: 'gender',
        titleKey: 'profile.stats.gender',
        value: t(genderKey),
        icon: User,
        iconColor: theme.colors.text.secondary,
      });
    }

    return statsArray;
  }, [
    metrics?.weight,
    metrics?.height,
    metrics?.bodyFat,
    metrics?.bmi,
    dbUser,
    weightUnit,
    heightUnit,
    t,
  ]);

  const getStatUnit = (stat: (typeof stats)[0]) => {
    if (stat.id === 'weight') {
      return weightUnit;
    }
    if (stat.id === 'height') {
      return heightUnit;
    }
    return stat.unit;
  };

  const handleSavePersonalInfo = async (data: PersonalInfo) => {
    try {
      await UserService.updateUserProfile({
        fullName: data.fullName,
        email: data.email,
        dateOfBirth: new Date(data.dob).getTime(),
        gender: data.gender as Gender,
        avatarIcon: data.avatarIcon || null,
        avatarColor: data.avatarColor || null,
      });
    } catch (err) {
      console.error('Failed to save personal info:', err);
    }
  };

  const handleSaveFitnessDetails = async (data: FitnessDetails) => {
    try {
      // Update units setting
      await SettingsService.setUnits(data.units);

      // Update user fitness details
      await UserService.updateUserProfile({
        fitnessGoal: data.fitnessGoal,
        activityLevel: data.activityLevel,
        liftingExperience: data.experience,
      });
    } catch (err) {
      console.error('Failed to save fitness details:', err);
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
              ) : null}
            </View>
            <Pressable
              className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-2 border-bg-primary"
              style={{ backgroundColor: theme.colors.accent.primary }}
              onPress={() => setIsEditPersonalVisible(true)}
            >
              <Edit size={theme.iconSize.sm} color={theme.colors.text.black} />
            </Pressable>
          </View>
          <Text className="mb-3 text-3xl font-bold text-text-primary">
            {dbUser?.fullName || t('profile.loading')}
          </Text>
          {dbUser?.fitnessGoal ? (
            <Text className="text-base text-text-primary">
              {t('profile.goal')}:{' '}
              {t(
                `editFitnessDetails.fitnessGoalLabels.${dbUser.fitnessGoal === 'weight_loss' ? 'weightLoss' : dbUser.fitnessGoal}`
              )}
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
          <View className="-mx-2 flex-row flex-wrap">
            {stats.map((stat) => (
              <View key={stat.id} className="mb-4 w-1/2 px-2">
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
            {MANAGEMENT_ITEMS.map((item) => (
              <ManagementItem
                key={item.id}
                title={t(item.titleKey)}
                description={t(item.descriptionKey)}
                icon={item.icon}
                iconColor={item.iconColor}
                onPress={() => {
                  if (item.id === 'personal') {
                    setIsEditPersonalVisible(true);
                  } else if (item.id === 'fitness') {
                    setIsEditFitnessVisible(true);
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

      {isBodyMetricsHistoryVisible ? (
        <BodyMetricsHistoryModal
          visible={isBodyMetricsHistoryVisible}
          onClose={() => setIsBodyMetricsHistoryVisible(false)}
        />
      ) : null}

      <EditPersonalInfoModal
        visible={isEditPersonalVisible}
        onClose={() => setIsEditPersonalVisible(false)}
        onSave={handleSavePersonalInfo}
        initialData={
          dbUser
            ? {
                fullName: dbUser.fullName,
                email: dbUser.email || '',
                dob: new Date(dbUser.dateOfBirth).toISOString().split('T')[0],
                gender: dbUser.gender,
                avatarIcon: dbUser.avatarIcon,
                avatarColor: dbUser.avatarColor,
              }
            : undefined
        }
      />

      <EditFitnessDetailsModal
        visible={isEditFitnessVisible}
        onClose={() => setIsEditFitnessVisible(false)}
        onSave={handleSaveFitnessDetails}
        initialData={
          dbUser && metrics
            ? {
                units,
                weight: metrics.weight?.toString() || '',
                height: metrics.height?.toString() || '',
                weightGoal: dbUser.weightGoal ?? 'maintain',
                fitnessGoal: dbUser.fitnessGoal,
                activityLevel: dbUser.activityLevel,
                experience: dbUser.liftingExperience,
              }
            : undefined
        }
      />
    </MasterLayout>
  );
}
