import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Sparkles, PlusCircle, Library, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { GradientText } from './GradientText';

type NewWorkoutCardProps = {
  variant?: 'default' | 'popular';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function NewWorkoutCard({ variant = 'default', icon, title, subtitle, onPress }: NewWorkoutCardProps) {
  const isPopular = variant === 'popular';

  const content = (
    <View
      style={[
        { padding: theme.spacing.padding.lg },
        isPopular
          ? {
              backgroundColor: theme.colors.background.aiCardBackground,
              borderRadius: theme.borderRadius.xl - 2,
            }
          : {
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.gap.base,
            },
      ]}>
      <View
        style={
          isPopular
            ? {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: theme.spacing.padding.sm,
              }
            : null
        }>
        <View
          style={[
            {
              width: isPopular ? theme.size['10'] : theme.size['12'],
              height: isPopular ? theme.size['10'] : theme.size['12'],
              borderRadius: theme.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
            },
            !isPopular && {
              backgroundColor: theme.colors.background.white5,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.white5,
            },
          ]}>
          {isPopular ? (
            <LinearGradient
              colors={theme.colors.gradients.cta}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: theme.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.accent,
              }}>
              {icon}
            </LinearGradient>
          ) : (
            icon
          )}
        </View>

        {isPopular && (
          <View
            style={{
              backgroundColor: theme.colors.background.white10,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: 2,
              borderRadius: theme.borderRadius.sm,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize['10'],
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.secondary,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
              Popular
            </Text>
          </View>
        )}
      </View>
      <View style={!isPopular ? { flex: 1 } : null}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.white,
          }}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary,
              marginTop: isPopular ? 4 : 2,
              lineHeight: isPopular ? 16 : undefined,
            }}>
            {subtitle}
          </Text>
        )}
      </View>

      {!isPopular && <ChevronRight size={20} color={theme.colors.text.tertiary} />}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: '100%',
          borderRadius: theme.borderRadius.xl,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !isPopular && {
          backgroundColor: pressed ? theme.colors.background.cardDark : theme.colors.background.cardElevated,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.white5,
          ...theme.shadows.md,
        },
      ]}>
      {isPopular ? (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 2 }}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

type CreateWorkoutOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onGenerateWithAi: () => void;
  onCreateEmptyTemplate: () => void;
  onBrowseTemplates: () => void;
};

export function CreateWorkoutOptionsModal({
  visible,
  onClose,
  onGenerateWithAi,
  onCreateEmptyTemplate,
  onBrowseTemplates,
}: CreateWorkoutOptionsModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const animatedStyle = (delay: number) => ({
    opacity: slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title=""
      scrollable={false}
      withGradient={false}>
      {/* Background Glows */}
      <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: theme.colors.accent.primary20,
            opacity: 0.2,
            // Blur is handled via opacity/size here since React Native blur is limited
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -50,
            left: -50,
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: theme.colors.status.indigo10,
            opacity: 0.1,
          }}
        />
      </View>

      {/* Custom Header to match mockup */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.padding.base,
          paddingTop: Platform.OS === 'ios' ? 60 : 40,
          paddingBottom: theme.spacing.padding.sm,
          zIndex: 50,
        }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            opacity: 0.8,
          }}>
          New Session
        </Text>
        <View style={{ width: theme.size['10'] }} />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.padding.xl,
          justifyContent: 'center',
          paddingBottom: 80,
        }}>
        {/* Title */}
        <Animated.View style={[animatedStyle(0), { marginBottom: theme.spacing.padding['2xl'] }]}>
          <Text
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              color: theme.colors.text.white,
              lineHeight: 36,
            }}>
            {"Let's crush a"}
          </Text>
          <GradientText
            colors={theme.colors.gradients.cta}
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              lineHeight: 36,
              marginBottom: theme.spacing.padding.xs,
            }}>
            new workout.
          </GradientText>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.padding.xs,
            }}>
            Select how you want to build your routine today.
          </Text>
        </Animated.View>

        <View style={{ gap: theme.spacing.gap.base }}>
          <Animated.View style={animatedStyle(100)}>
            <NewWorkoutCard
              variant="popular"
              icon={<Sparkles size={22} color={theme.colors.text.white} />}
              title="Generate with AI"
              subtitle="Let Musclog build a personalized routine based on your goals and equipment."
              onPress={onGenerateWithAi}
            />
          </Animated.View>

          <Animated.View style={animatedStyle(200)}>
            <NewWorkoutCard
              variant="default"
              icon={<PlusCircle size={24} color={theme.colors.text.gray300} />}
              title="Create from Empty Template"
              subtitle="Design your own routine from scratch, exercise by exercise."
              onPress={onCreateEmptyTemplate}
            />
          </Animated.View>

          <Animated.View style={animatedStyle(300)}>
            <NewWorkoutCard
              variant="default"
              icon={<Library size={24} color={theme.colors.text.gray300} />}
              title="Browse Templates"
              subtitle="Explore expert-created programs and community favorites."
              onPress={onBrowseTemplates}
            />
          </Animated.View>
        </View>
      </View>
    </FullScreenModal>
  );
}
