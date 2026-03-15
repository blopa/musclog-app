import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { ChevronLeft, UserPlus, Search, Plus, Copy, Share2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View, Share, Alert } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { GroupsService } from '../../services/GroupsService';
import { theme } from '../../theme';

export default function CommunityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [groupId, setGroupId] = useState('');
  const [generatedGroupId, setGeneratedGroupId] = useState<string | null>(null);

  const handleJoinGroup = async () => {
    if (!groupId.trim()) return;
    try {
      await GroupsService.joinGroup(groupId.trim());
      router.push(`/groups/${groupId.trim()}`);
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.unknown'));
    }
  };

  const handleCreateGroup = async () => {
    try {
      const newId = await GroupsService.createGroup();
      setGeneratedGroupId(newId);
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.unknown'));
    }
  };

  const handleCopyId = async () => {
    if (generatedGroupId) {
      await Clipboard.setStringAsync(generatedGroupId);
      Alert.alert(t('groups.community.shareSuccess'), t('groups.community.copied'));
    }
  };

  const handleShareId = async () => {
    if (generatedGroupId) {
      await Share.share({
        message: t('groups.community.shareMessage', { groupId: generatedGroupId }),
      });
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-8 flex-row items-center justify-between">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary">{t('groups.community.title')}</Text>
          <View className="h-10 w-10" />
        </View>

        <Text className="mb-2 text-4xl font-bold text-text-primary">{t('groups.community.heroTitle')}</Text>
        <Text className="mb-10 text-lg text-text-secondary">
          {t('groups.community.heroSubtitle')}
        </Text>

        {/* Join Group Section */}
        <View className="mb-10">
          <View className="mb-4 flex-row items-center gap-2">
            <UserPlus size={20} color={theme.colors.accent.primary} />
            <Text className="text-xl font-bold text-text-primary">{t('groups.community.joinSection')}</Text>
          </View>
          <View className="rounded-3xl bg-bg-card p-6 border border-white/5">
            <View className="mb-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">{t('groups.community.groupIdLabel')}</Text>
              <TextInput
                className="rounded-2xl bg-bg-primary px-5 py-4 text-text-primary border border-white/10"
                placeholder={t('groups.community.groupIdPlaceholder')}
                placeholderTextColor={theme.colors.text.tertiary}
                value={groupId}
                onChangeText={setGroupId}
                autoCapitalize="characters"
              />
            </View>
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-accent-primary py-4"
              onPress={handleJoinGroup}
            >
              <Text className="text-lg font-bold text-text-primary">{t('groups.community.findGroup')}</Text>
              <Search size={20} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        <View className="mb-10 flex-row items-center gap-4">
          <View className="h-[1px] flex-1 bg-white/10" />
          <Text className="text-sm font-bold text-text-tertiary">OR</Text>
          <View className="h-[1px] flex-1 bg-white/10" />
        </View>

        {/* Create Group Section */}
        <View>
          <View className="mb-4 flex-row items-center gap-2">
            <Plus size={20} color={theme.colors.accent.primary} />
            <Text className="text-xl font-bold text-text-primary">{t('groups.community.startSection')}</Text>
          </View>

          {!generatedGroupId ? (
            <Pressable
              className="items-center justify-center rounded-3xl border-2 border-dashed border-accent-primary/30 py-12"
              onPress={handleCreateGroup}
            >
              <Plus size={32} color={theme.colors.accent.primary} />
              <Text className="mt-2 font-bold text-accent-primary">{t('groups.community.generateGroup')}</Text>
            </Pressable>
          ) : (
            <View className="items-center rounded-3xl border-2 border-dashed border-accent-primary/30 p-8">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">{t('groups.community.newGroupGenerated')}</Text>
              <Text className="mb-8 text-5xl font-black tracking-tighter text-accent-primary">{generatedGroupId}</Text>

              <View className="flex-row gap-4">
                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-accent-primary py-4"
                  onPress={handleCopyId}
                >
                  <Copy size={20} color={theme.colors.text.primary} />
                  <Text className="font-bold text-text-primary">{t('groups.community.copyId')}</Text>
                </Pressable>
                <Pressable
                  className="h-14 w-14 items-center justify-center rounded-2xl bg-bg-overlay"
                  onPress={handleShareId}
                >
                  <Share2 size={24} color={theme.colors.text.primary} />
                </Pressable>
              </View>
            </View>
          )}

          <Text className="mt-4 text-center text-sm text-text-tertiary">
            {t('groups.community.footerNote')}
          </Text>
        </View>
      </View>
    </MasterLayout>
  );
}
