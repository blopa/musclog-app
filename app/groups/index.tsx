import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Users, ChevronRight } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { GroupsService } from '../../services/GroupsService';
import { theme } from '../../theme';

export default function MyGroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<string[]>([]);

  const loadGroups = useCallback(async () => {
    const myGroups = await GroupsService.getMyGroups();
    setGroups(myGroups);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  return (
    <MasterLayout>
      <View className="flex-1 px-4 py-6">
        <View className="mb-8 flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-text-primary">{t('groups.title')}</Text>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.push('/groups/community')}
          >
            <Plus size={24} color={theme.colors.text.primary} />
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-bg-overlay">
              <Users size={40} color={theme.colors.text.tertiary} />
            </View>
            <Text className="mb-2 text-xl font-semibold text-text-primary">{t('groups.empty.title')}</Text>
            <Text className="mb-8 text-center text-text-secondary">
              {t('groups.empty.description')}
            </Text>
            <Pressable
              className="rounded-xl bg-accent-primary px-8 py-4"
              onPress={() => router.push('/groups/community')}
            >
              <Text className="font-bold text-text-primary">{t('groups.community.title')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {groups.map((groupId) => (
              <Pressable
                key={groupId}
                className="mb-4 flex-row items-center justify-between rounded-2xl bg-bg-card p-5 border border-white/5"
                onPress={() => router.push(`/groups/${groupId}`)}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-accent-primary/20">
                    <Users size={24} color={theme.colors.accent.primary} />
                  </View>
                  <View>
                    <Text className="text-lg font-bold text-text-primary">{groupId}</Text>
                    <Text className="text-sm text-text-secondary">Group ID</Text>
                  </View>
                </View>
                <ChevronRight size={20} color={theme.colors.text.tertiary} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </MasterLayout>
  );
}
