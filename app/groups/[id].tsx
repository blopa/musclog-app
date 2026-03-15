import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share2, Award, User } from 'lucide-react-native';
import React, { useState, useEffect, createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { GroupsService, type GroupMember } from '../../services/GroupsService';
import { theme } from '../../theme';
import { getAvatarDisplayProps } from '../../utils/avatarUtils';

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'volume' | 'frequency'>('volume');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRanking = async () => {
      if (!id) return;
      setLoading(true);
      const ranking = await GroupsService.getGroupRanking(id);

      // Sort based on active tab
      const sorted = [...ranking].sort((a, b) =>
        activeTab === 'volume' ? b.volume - a.volume : b.frequency - a.frequency
      ).map((m, index) => ({ ...m, rank: index + 1 }));

      setMembers(sorted);
      setLoading(false);
    };

    loadRanking();
  }, [id, activeTab]);

  const renderMember = (member: GroupMember) => {
    const isFirst = member.rank === 1;
    const isCurrentUser = member.isCurrentUser;

    return (
      <View
        key={member.id}
        className={`mb-4 flex-row items-center gap-4 rounded-3xl p-5 border ${
          isCurrentUser
            ? 'bg-accent-primary/10 border-accent-primary'
            : 'bg-bg-card border-white/5'
        }`}
        style={isFirst ? { borderColor: '#EAB308', borderWidth: 1 } : {}}
      >
        <View className="items-center justify-center w-8">
          <Text className={`text-xl font-bold ${
            isFirst ? 'text-yellow-500' : isCurrentUser ? 'text-accent-primary' : 'text-text-secondary'
          }`}>
            {member.rank}
          </Text>
          {isFirst && <Award size={14} color="#EAB308" />}
        </View>

        <View
          className="h-14 w-14 items-center justify-center rounded-full overflow-hidden border-2"
          style={{
            borderColor: member.avatarIcon
              ? getAvatarDisplayProps(member.avatarIcon as any, member.avatarColor as any).color
              : theme.colors.text.tertiary,
            backgroundColor: member.avatarIcon
              ? getAvatarDisplayProps(member.avatarIcon as any, member.avatarColor as any).backgroundColor
              : theme.colors.background.overlay
          }}
        >
          {member.avatarIcon ? (
            createElement(getAvatarDisplayProps(member.avatarIcon as any, member.avatarColor as any).IconComponent, {
              size: 24,
              color: getAvatarDisplayProps(member.avatarIcon as any, member.avatarColor as any).color,
            })
          ) : (
            <User size={24} color={theme.colors.text.tertiary} />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary" numberOfLines={1}>
            {member.name}
          </Text>
          <Text className={`text-xs font-medium ${isCurrentUser ? 'text-accent-primary' : 'text-text-tertiary'}`}>
            {member.subtitle}
          </Text>
        </View>

        <View className="items-end">
          <Text className={`text-lg font-black ${isCurrentUser ? 'text-accent-primary' : 'text-text-primary'}`}>
            {activeTab === 'volume' ? member.volume.toLocaleString() : member.frequency}
          </Text>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
            {activeTab === 'volume' ? 'KG VOLUME' : 'WORKOUTS'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-6">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary">Group ID: #{id}</Text>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => {}}
          >
            <Share2 size={20} color={theme.colors.text.primary} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View className="mb-8 flex-row px-4">
          <Pressable
            className={`flex-1 items-center pb-3 border-b-2 ${activeTab === 'volume' ? 'border-accent-primary' : 'border-transparent'}`}
            onPress={() => setActiveTab('volume')}
          >
            <Text className={`font-bold ${activeTab === 'volume' ? 'text-accent-primary' : 'text-text-tertiary'}`}>
              {t('groups.ranking.workoutVolume')}
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 items-center pb-3 border-b-2 ${activeTab === 'frequency' ? 'border-accent-primary' : 'border-transparent'}`}
            onPress={() => setActiveTab('frequency')}
          >
            <Text className={`font-bold ${activeTab === 'frequency' ? 'text-accent-primary' : 'text-text-tertiary'}`}>
              {t('groups.ranking.frequency')}
            </Text>
          </Pressable>
          <View className="flex-1 items-center pb-3 border-b-2 border-transparent opacity-50">
            <Text className="font-bold text-text-tertiary">{t('groups.ranking.duration')}</Text>
          </View>
        </View>

        <View className="mb-6 items-center px-4">
          <Text className="text-3xl font-black text-text-primary">{t('groups.ranking.last7Days')}</Text>
          <Text className="text-sm font-medium text-accent-primary">{t('groups.ranking.updateInterval')}</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          </View>
        ) : (
          <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
            {members.map(renderMember)}
            <View className="h-10" />
          </ScrollView>
        )}
      </View>
    </MasterLayout>
  );
}
