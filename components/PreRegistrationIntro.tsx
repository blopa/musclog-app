import React from 'react';
import { View } from 'react-native';
import { theme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function PreRegistrationIntro() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background.primary,
      }}
    >
      {/* Top Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 24 }}>
        <View style={{ width: theme.size[12] }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              height: 6,
              width: 32,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.background.primary,
              shadowColor: theme.colors.background.primary,
              shadowOpacity: 0.3,
              shadowRadius: 10,
            }}
          />
          <View
            style={{
              height: 4,
              width: 4,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.background.secondary,
            }}
          />
          <View
            style={{
              height: 4,
              width: 4,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.background.secondary,
            }}
          />
        </View>
        <View style={{ width: theme.size[12] }} />
      </View>

      {/* Main Content */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: theme.components.modal.defaultMaxWidth,
          marginHorizontal: 'auto',
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
      >
        {/* Illustration Section */}
        <View
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: 1,
            marginBottom: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LinearGradient
            colors={['rgba(79, 70, 229, 0.3)', 'rgba(41, 224, 142, 0.1)', 'rgba(16, 185, 129, 0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: theme.borderRadius.full,
              opacity: 0.7,
            }}
          />
          <View
            style={{
              position: 'relative',
              width: 256,
              height: 256,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: theme.borderRadius.full,
                transform: [{ scale: 1.1 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: theme.borderRadius.full,
                transform: [{ scale: 1.25 }],
              }}
            />
            <View
              style={{
                position: 'relative',
                width: 160,
                height: 160,
                borderRadius: theme.borderRadius.full,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: 'rgba(79, 70, 229, 0.4)',
                shadowRadius: 40,
                shadowOffset: { width: 0, height: -10 },
              }}
            >
              <MaterialIcons name="person" size={64} color="transparent" />
              <View
                style={{
                  position: 'absolute',
                  top: -16,
                  right: -16,
                  width: 56,
                  height: 56,
                  borderRadius: theme.borderRadius['2xl'],
                  backgroundColor: 'linear-gradient(135deg, #4f46e5 0%, #29e08e 100%)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: theme.colors.background.primary,
                  shadowRadius: 20,
                }}
              >
                <MaterialIcons name="insights" size={24} color="white" />
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: -32,
                  width: 40,
                  height: 40,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="fitness-center" size={20} color={theme.colors.background.primary} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
