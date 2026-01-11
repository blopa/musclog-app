import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Sparkles, PlusCircle, Library, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { GradientText } from './GradientText';

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
          {/* AI Card */}
          <Animated.View style={animatedStyle(100)}>
            <Pressable
              onPress={onGenerateWithAi}
              style={({ pressed }) => [
                {
                  position: 'relative',
                  width: '100%',
                  borderRadius: theme.borderRadius.xl,
                  overflow: 'hidden',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}>
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 2 }}>
                <View
                  style={{
                    backgroundColor: theme.colors.background.aiCardBackground,
                    borderRadius: theme.borderRadius.xl - 2,
                    padding: theme.spacing.padding.lg,
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: theme.spacing.padding.sm,
                    }}>
                    <LinearGradient
                      colors={theme.colors.gradients.cta}
                      style={{
                        width: theme.size['10'],
                        height: theme.size['10'],
                        borderRadius: theme.borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...theme.shadows.accent,
                      }}>
                      <Sparkles size={22} color={theme.colors.text.white} />
                    </LinearGradient>
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
                  </View>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.white,
                    }}>
                    Generate with AI
                  </Text>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                      marginTop: 4,
                      lineHeight: 16,
                    }}>
                    Let Musclog build a personalized routine based on your goals and equipment.
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Create Empty Template Card */}
          <Animated.View style={animatedStyle(200)}>
            <Pressable
              onPress={onCreateEmptyTemplate}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.base,
                  backgroundColor: pressed
                    ? theme.colors.background.cardDark
                    : theme.colors.background.cardElevated,
                  padding: theme.spacing.padding.lg,
                  borderRadius: theme.borderRadius.xl,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadows.md,
                },
              ]}>
              <View
                style={{
                  width: theme.size['12'],
                  height: theme.size['12'],
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                }}>
                <PlusCircle size={24} color={theme.colors.text.gray300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.white,
                  }}>
                  Create from Empty Template
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                  }}>
                  Design your own routine from scratch, exercise by exercise.
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </Animated.View>

          {/* Browse Templates Card */}
          <Animated.View style={animatedStyle(300)}>
            <Pressable
              onPress={onBrowseTemplates}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.base,
                  backgroundColor: pressed
                    ? theme.colors.background.cardDark
                    : theme.colors.background.cardElevated,
                  padding: theme.spacing.padding.lg,
                  borderRadius: theme.borderRadius.xl,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadows.md,
                },
              ]}>
              <View
                style={{
                  width: theme.size['12'],
                  height: theme.size['12'],
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                }}>
                <Library size={24} color={theme.colors.text.gray300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.white,
                  }}>
                  Browse Templates
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                  }}>
                  Explore expert-created programs and community favorites.
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </FullScreenModal>
  );
}
