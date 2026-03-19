import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();

  useEffect(() => {
    // Handle deep links
    if (params.action === 'open-camera') {
      router.replace('/nutrition/ai-camera');
      return;
    }

    if (params.action === 'open-nutrition') {
      router.replace('/nutrition/food');
      return;
    }

    if (params.action === 'open-nutrition-checkin') {
      if (params.id) {
        router.replace({
          pathname: '/nutrition/checkin-review',
          params: { id: params.id as string }
        });
      } else {
        router.replace('/nutrition/checkin');
      }
      return;
    }

    // Default: go to home/dashboard
    router.replace('/(tabs)');
  }, [params, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background.primary }}>
      <ActivityIndicator color={theme.colors.accent.primary} />
    </View>
  );
}
