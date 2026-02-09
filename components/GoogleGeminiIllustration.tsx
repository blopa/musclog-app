import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Zap } from 'lucide-react-native';
import { Image, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { GoogleLogoSvg } from './icons/GoogleLogoSvg';

export const GoogleGeminiIllustration = () => {
  const theme = useTheme();
  return (
    <View className="mb-6 mt-2">
      <View className="relative w-full" style={{ aspectRatio: theme.aspectRatio.landscape }}>
        {/* Glow effect wrapper - gradient blur */}
        <View
          className="absolute"
          style={{
            top: -theme.spacing.margin['2'],
            left: -theme.spacing.margin['2'],
            right: -theme.spacing.margin['2'],
            bottom: -theme.spacing.margin['2'],
            borderRadius: theme.borderRadius['2xl'],
            opacity: theme.colors.opacity.subtle,
          }}
        >
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
        <View
          className="relative flex-1 rounded-2xl border border-white/5 bg-bg-cardDark"
          style={{ overflow: 'hidden' }}
        >
          {/* Background image */}
          <View className="absolute inset-0" style={{ opacity: theme.colors.opacity.strong }}>
            <Image
              source={require('../assets/ai-background.png')}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode="stretch"
            />
          </View>
          {/* Gradient overlay - from bottom to top */}
          <LinearGradient
            colors={[
              theme.colors.overlay.backdrop90, // 90% opacity at bottom
              theme.colors.background.primary20, // 20% opacity in middle
              'transparent', // transparent at top
            ]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            className="absolute inset-0"
          />
          {/* Bottom buttons overlay */}
          <View
            className="absolute left-0 right-0 flex-row items-center justify-center"
            style={{ bottom: theme.spacing.padding.base }}
          >
            {/* Single pill container */}
            <View
              className="flex-row items-center gap-3 rounded-full border border-white/20 px-4 py-2.5"
              style={{
                backgroundColor: theme.colors.background.white10,
                ...theme.shadows.lg,
              }}
            >
              {/* Google logo button - white circle */}
              <View
                className="items-center justify-center rounded-full bg-white"
                style={{
                  padding: theme.spacing.padding['1half'],
                  minWidth: theme.iconSize['2xl'],
                  minHeight: theme.iconSize['2xl'],
                  ...theme.shadows.sm,
                }}
              >
                <GoogleLogoSvg size={theme.iconSize.sm} />
              </View>
              {/* Sparkles icon - directly in pill, no background */}
              <Sparkles
                size={theme.iconSize.lg}
                color={theme.colors.status.emeraldLight} // #29e08e - primary from HTML
                fill={theme.colors.status.emeraldLight}
              />
              {/* Zap icon - green circle with glow shadow */}
              <View
                className="rounded-full p-1.5"
                style={{
                  backgroundColor: theme.colors.status.emeraldLight, // #29e08e - primary from HTML
                  shadowColor: theme.colors.status.emeraldLight,
                  shadowOffset: theme.shadowOffset.zero,
                  shadowOpacity: theme.colors.opacity.subtle,
                  shadowRadius: theme.shadows.radius15.shadowRadius,
                  elevation: theme.elevation.lg,
                }}
              >
                <Zap
                  size={theme.iconSize.md}
                  color={theme.colors.background.darkBackground}
                  fill={theme.colors.background.darkBackground}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
