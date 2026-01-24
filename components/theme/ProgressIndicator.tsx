import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

type ProgressIndicatorProps = {
  message?: string;
  size?: 'small' | 'large';
};

export function ProgressIndicator({ message, size = 'large' }: ProgressIndicatorProps) {
  const { t } = useTranslation();
  const displayMessage = message || t('common.loading');
  return (
    <View
      className="w-full py-6"
      style={{
        minHeight: theme.size['40'],
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
      }}
    >
      <View
        className="rounded-3xl"
        style={{
          backgroundColor: theme.colors.background.cardElevated,
          borderColor: theme.colors.border.default,
          borderWidth: theme.borderWidth.thin,
          padding: theme.spacing.padding['6'],
          width: '100%',
        }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: theme.size['18'],
              height: theme.size['18'],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Outer ring */}
            <View
              style={{
                position: 'absolute',
                width: theme.size['18'],
                height: theme.size['18'],
                borderRadius: theme.size['18'] / 2,
                borderWidth: theme.borderWidth.thick6,
                borderColor: theme.colors.background.black15,
              }}
            />
            {/* Progress arc using smaller view with accent color on top */}
            <View
              style={{
                position: 'absolute',
                top: theme.borderWidth.thick6,
                left: theme.borderWidth.thick6,
                width: theme.size['14'],
                height: theme.size['14'],
                borderRadius: theme.size['14'] / 2,
                borderWidth: theme.borderWidth.thick6,
                borderColor: theme.colors.accent.primary,
                transform: [{ rotate: '45deg' }],
                overflow: 'hidden',
              }}
            />
            <ActivityIndicator
              // ActivityIndicator accepts 'small' | 'large' | number
              size={size === 'large' ? 'large' : 'small'}
              color={theme.colors.accent.primary}
              style={{ transform: [{ scale: size === 'large' ? 1.4 : 1 }] }}
            />
          </View>

          {displayMessage ? (
            <Text
              style={{
                marginTop: theme.spacing.padding.lg,
                textAlign: 'center',
                color: theme.colors.accent.primary,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
            >
              {displayMessage}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
