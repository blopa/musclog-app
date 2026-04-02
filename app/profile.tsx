import { useRouter } from 'expo-router';
import {
  Activity,
  CheckCircle,
  Dumbbell,
  Edit,
  Heart,
  List,
  Ruler,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react-native';
import { createElement, useEffect, useMemo, useState } from 'react';
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
import { AnimatedContent } from '../components/theme/AnimatedContent';
import { ProgressIndicator } from '../components/theme/ProgressIndicator';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { type Gender } from '../database/models';
import { UserService } from '../database/services';
import { useFormatAppNumber } from '../hooks/useFormatAppNumber';
import { useSettings } from '../hooks/useSettings';
import { useSyncTracking } from '../hooks/useSyncTracking';
import { useTheme } from '../hooks/useTheme';
import { useUser } from '../hooks/useUser';
import { useUserMetrics } from '../hooks/useUserMetrics';
import { OpenAiCodexAuthService } from '../services/OpenAiCodexAuthService';
import { getAvatarDisplayProps } from '../utils/avatarUtils';
import { calculateBMIWithStatus } from '../utils/bmiHelper';
import {
  formatDateOfBirthFromTimestamp,
  persistFitnessDetails,
} from '../utils/fitnessProfilePersistence';

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { units, weightUnit, heightUnit } = useSettings();
  const { formatDecimal, formatInteger } = useFormatAppNumber();

  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const { metrics, isLoading: isLoadingMetrics } = useUserMetrics();
  const { isSyncing, syncNow } = useSyncTracking();
  const [isCodexConnected, setIsCodexConnected] = useState(false);
  const [isBodyMetricsHistoryVisible, setIsBodyMetricsHistoryVisible] = useState(false);
  const [isEditPersonalVisible, setIsEditPersonalVisible] = useState(false);
  const [isEditFitnessVisible, setIsEditFitnessVisible] = useState(false);

  const managementItems = useMemo(
    () => [
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
    [theme]
  );

  useEffect(() => {
    syncNow();
  }, [syncNow]);

  useEffect(() => {
    const checkCodex = async () => {
      const connected = await OpenAiCodexAuthService.isConnected();
      setIsCodexConnected(connected);
    };
    checkCodex();
  }, []);

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
      icon:
        | typeof TrendingUp
        | typeof TrendingDown
        | typeof CheckCircle
        | typeof User
        | typeof Activity
        | typeof Heart
        | typeof Ruler;
      iconColor: string;
    }[] = [];

    // Weight stat
    if (metrics?.weight !== undefined) {
      const weightGoal = dbUser?.weightGoal ?? 'maintain';
      const isGainPhase = weightGoal === 'gain';
      const isLosePhase = weightGoal === 'lose';

      statsArray.push({
        id: 'weight',
        titleKey: 'profile.stats.weight',
        value: formatDecimal(metrics.weight, 1),
        unit: weightUnit,
        icon: isGainPhase ? TrendingUp : isLosePhase ? TrendingDown : TrendingUp,
        iconColor: isGainPhase
          ? theme.colors.status.success
          : isLosePhase
            ? theme.colors.status.warning
            : theme.colors.accent.primary,
      });
    }

    // Height stat
    if (metrics?.height !== undefined) {
      statsArray.push({
        id: 'height',
        titleKey: 'profile.stats.height',
        value: formatInteger(Math.round(metrics.height)),
        unit: heightUnit,
        status: 'Verified',
        icon: Ruler,
        iconColor: theme.colors.text.secondary,
      });
    }

    // Body fat stat
    if (metrics?.bodyFat !== undefined) {
      const weightGoal = dbUser?.weightGoal ?? 'maintain';
      const isGainPhase = weightGoal === 'gain';
      const isLosePhase = weightGoal === 'lose';

      statsArray.push({
        id: 'bodyFat',
        titleKey: 'profile.stats.bodyFat',
        value: formatDecimal(metrics.bodyFat, 1),
        unit: '%',
        icon: isGainPhase ? TrendingUp : isLosePhase ? TrendingDown : TrendingUp,
        iconColor: isGainPhase
          ? theme.colors.status.warning
          : isLosePhase
            ? theme.colors.status.success
            : theme.colors.status.warning,
      });
    }

    // BMI stat
    if (metrics?.weight !== undefined && metrics?.height !== undefined) {
      // Calculate BMI and get status using helper function
      const bmiResult = calculateBMIWithStatus(
        metrics.weight,
        metrics.height,
        weightUnit,
        heightUnit
      );
      const calculatedBMI = bmiResult.bmi;
      const bmiStatusKey = bmiResult.statusKey;
      statsArray.push({
        id: 'bmi',
        titleKey: 'profile.stats.bmi',
        value: formatDecimal(calculatedBMI, 1),
        status: t(bmiStatusKey),
        statusColor: theme.colors.status.info,
        icon: Activity,
        iconColor: theme.colors.status.info,
      });
    }

    // Age stat (from user)
    if (dbUser) {
      statsArray.push({
        id: 'age',
        titleKey: 'profile.stats.age',
        value: dbUser.getAge().toString(),
        icon: Heart,
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
    dbUser,
    weightUnit,
    heightUnit,
    t,
    theme,
    formatDecimal,
    formatInteger,
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
      await persistFitnessDetails(data);
    } catch (err) {
      console.error('Failed to save fitness details:', err);
    }
  };

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Syncing Indicator */}
        {isSyncing ? (
          <View className="px-4 pt-6">
            <ProgressIndicator message={t('profile.syncing.healthKit')} />
          </View>
        ) : null}
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-6">
          <Text className="text-4xl font-bold text-text-primary">{t('profile.header.title')}</Text>
          <Pressable
            className="active:bg-bg-card-elevated h-12 w-12 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.navigate('/settings')}
          >
            <Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* User Profile Section */}
        <View className="mb-8 items-center">
          {isLoadingUser ? (
            <View className="items-center gap-3">
              <SkeletonLoader width={128} height={128} borderRadius={64} />
              <SkeletonLoader width={200} height={28} borderRadius={8} />
            </View>
          ) : (
            <AnimatedContent style={{ alignItems: 'center' }}>
              <>
                <View className="relative mb-4">
                  <View
                    className="h-32 w-32 overflow-hidden rounded-full border-4"
                    style={{
                      borderColor: dbUser
                        ? getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor).color
                        : theme.colors.accent.primary,
                      backgroundColor: dbUser
                        ? getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
                            .backgroundColor
                        : theme.colors.accent.primary20,
                    }}
                  >
                    {dbUser?.avatarIcon ? (
                      <View className="h-full w-full items-center justify-center rounded-full">
                        {createElement(
                          getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
                            .IconComponent,
                          {
                            size: 40,
                            color: getAvatarDisplayProps(
                              theme,
                              dbUser.avatarIcon,
                              dbUser.avatarColor
                            ).color,
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
                <View className="mb-3 flex-row items-center justify-center gap-2">
                  <Text className="text-center text-3xl font-bold text-text-primary">
                    {dbUser?.fullName || t('profile.loading')}
                  </Text>
                  {isCodexConnected ? (
                    <View
                      className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ backgroundColor: theme.colors.status.success20 }}
                    >
                      <CheckCircle size={12} color={theme.colors.status.success} />
                      <Text
                        className="text-[10px] font-bold uppercase"
                        style={{ color: theme.colors.status.success }}
                      >
                        Codex
                      </Text>
                    </View>
                  ) : null}
                </View>
                {dbUser?.fitnessGoal ? (
                  <Text className="text-center text-base text-text-primary">
                    {t('profile.goal')}:{' '}
                    {t(
                      `editFitnessDetails.fitnessGoalLabels.${dbUser.fitnessGoal === 'weight_loss' ? 'weightLoss' : dbUser.fitnessGoal}`
                    )}
                  </Text>
                ) : null}
              </>
            </AnimatedContent>
          )}
        </View>

        {/* Current Stats Section */}
        <View className="mb-8 px-4">
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
            {isLoadingMetrics || isLoadingUser ? (
              [1, 2, 3, 4].map((i) => (
                <View key={i} className="mb-4 w-1/2 px-2">
                  <SkeletonLoader height={80} borderRadius={12} />
                </View>
              ))
            ) : (
              <AnimatedContent
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  width: '100%',
                  marginHorizontal: -8,
                }}
              >
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
              </AnimatedContent>
            )}
          </View>
        </View>

        {/* Management Section */}
        <View className="mb-8 px-4">
          <Text className="mb-4 text-2xl font-bold text-text-primary">
            {t('profile.management')}
          </Text>
          <View className="gap-3">
            {managementItems.map((item) => (
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
                    router.navigate('/settings');
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
        hideDob
        initialData={
          dbUser
            ? {
                fullName: dbUser.fullName,
                email: dbUser.email || '',
                dob: '',
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
                dob: formatDateOfBirthFromTimestamp(dbUser.dateOfBirth),
                gender: dbUser.gender,
                units,
                weight: metrics.weight?.toString() || '',
                height: metrics.height?.toString() || '',
                fatPercentage: metrics.bodyFat,
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
