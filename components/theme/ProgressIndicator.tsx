import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { theme } from '../../theme';

type ProgressIndicatorProps = {
  message?: string;
  size?: 'small' | 'large';
};

export function ProgressIndicator({
  message = 'Loading...',
  size = 'large',
}: ProgressIndicatorProps) {
  return (
    <View
      className="w-full py-6"
      style={{
        minHeight: 160,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
      }}>
      <View
        className="rounded-3xl"
        style={{
          backgroundColor: theme.colors.background.cardElevated,
          borderColor: theme.colors.border.default,
          borderWidth: 1,
          padding: 24,
          width: '100%',
        }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {/* Outer ring */}
            <View
              style={{
                position: 'absolute',
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 6,
                borderColor: 'rgba(0,0,0,0.15)',
              }}
            />
            {/* Progress arc using smaller view with accent color on top */}
            <View
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                width: 60,
                height: 60,
                borderRadius: 30,
                borderWidth: 6,
                borderColor: theme.colors.accent.primary,
                transform: [{ rotate: '45deg' }],
                overflow: 'hidden',
              }}
            />
            <ActivityIndicator
              size={size}
              color={theme.colors.accent.primary}
              style={{ transform: [{ scale: size === 'large' ? 1.4 : 1 }] }}
            />
          </View>

          {message && (
            <Text
              style={{
                marginTop: 18,
                textAlign: 'center',
                color: theme.colors.accent.primary,
                fontSize: 18,
                fontWeight: '600',
              }}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
