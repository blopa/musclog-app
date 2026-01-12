import React from 'react';
import { View, Image } from 'react-native';
import { Sparkles, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

export const GoogleGeminiIllustration = ({
  googleLogoUrl,
  backgroundImageUrl,
}: {
  googleLogoUrl: string;
  backgroundImageUrl: string;
}) => {
  return (
    <View className="mb-6 mt-2">
      <View className="relative w-full" style={{ aspectRatio: 4 / 3 }}>
        {/* Glow effect wrapper */}
        <View
          className="absolute"
          style={{
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: theme.borderRadius['2xl'],
            backgroundColor: theme.colors.accent.primary,
            opacity: 0.3,
            shadowColor: theme.colors.accent.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
          }}
        />
        {/* Main card */}
        <View className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 bg-bg-cardDark">
          {/* Background image */}
          <View className="absolute inset-0" style={{ opacity: 0.8 }}>
            <Image
              source={{ uri: backgroundImageUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          </View>
          {/* Gradient overlay */}
          <LinearGradient
            colors={[
              'transparent',
              theme.colors.background.primary + '33', // 20% opacity
              theme.colors.background.primary + 'E6', // 90% opacity
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="absolute inset-0"
          />
          {/* Bottom buttons overlay */}
          <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center gap-2">
            {/* Google logo button - white background */}
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-white">
              <Image
                source={{
                  uri: googleLogoUrl,
                }}
                className="h-5 w-5"
                resizeMode="contain"
              />
            </View>
            {/* Sparkles button - dark background with light green icons */}
            <View
              className="h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
              <Sparkles
                size={18}
                color={theme.colors.status.emeraldLight}
                fill={theme.colors.status.emeraldLight}
              />
            </View>
            {/* Zap button - dark background with bright green icon */}
            <View
              className="h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
              <Zap
                size={18}
                color={theme.colors.accent.primary}
                fill={theme.colors.accent.primary}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
