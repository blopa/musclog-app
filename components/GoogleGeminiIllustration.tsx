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
        {/* Glow effect wrapper - gradient blur */}
        <View
          className="absolute"
          style={{
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: theme.borderRadius['2xl'],
            opacity: 0.3,
          }}>
          <LinearGradient
            colors={[
              theme.colors.accent.primary, // primary
              theme.colors.status.emerald, // emerald-500
              theme.colors.accent.tertiary, // teal
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: theme.borderRadius['2xl'],
              width: '100%',
              height: '100%',
            }}
          />
        </View>
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
          {/* Gradient overlay - from bottom to top */}
          <LinearGradient
            colors={[
              theme.colors.background.primary + 'E6', // 90% opacity at bottom
              theme.colors.background.primary + '33', // 20% opacity in middle
              'transparent', // transparent at top
            ]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            className="absolute inset-0"
          />
          {/* Bottom buttons overlay */}
          <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center">
            {/* Single pill container */}
            <View
              className="flex-row items-center gap-3 rounded-full border border-white/20 px-4 py-2.5"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                ...theme.shadows.lg,
              }}>
              {/* Google logo button - white circle */}
              <View className="rounded-full bg-white p-1.5" style={theme.shadows.sm}>
                <Image
                  source={{
                    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDjeI4ad2IaWbBhnLQwpPkGJHZTJI_AZ1dIssXH__JLkQoYD_Qm_649_s2NsALfqefCg8-FNDsip3kbi3ZsYEqkdMXwpZEmfUOsmkxzCOTW2CdWBOOCnqgZ_Bgrq-S9vigmQajIBEFLcWErkfxsQCsPyfFy1ynq4Iz7Zb5gK74Ymge1VRW0z0aGL9BZjeAWO6sQepsDa91JCegUclE123Tm5VN1Oi94_nDfjS1TRvsc5nyQLQmD3pXLQDuSb6wQLcPYWv4tphDZ_z',
                  }}
                  className="h-4 w-4"
                  resizeMode="contain"
                />
              </View>
              {/* Sparkles icon - directly in pill, no background */}
              <Sparkles
                size={20}
                color={theme.colors.accent.primary}
                fill={theme.colors.accent.primary}
              />
              {/* Zap icon - green circle */}
              <View
                className="rounded-full p-1.5"
                style={{
                  backgroundColor: theme.colors.accent.primary,
                  shadowColor: theme.colors.accent.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                }}>
                <Zap
                  size={18}
                  color={theme.colors.background.primary}
                  fill={theme.colors.background.primary}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
