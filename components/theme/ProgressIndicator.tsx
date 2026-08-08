import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type ProgressIndicatorProps = {
  message?: string;
  size?: 'small' | 'large';
};

export function ProgressIndicator({ message, size = 'large' }: ProgressIndicatorProps) {
  const theme = useTheme();
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
          {/*
            One spinner, nothing behind it. This used to stack three circular elements: a static
            grey ring, a second "progress arc" ring inset on top/left only — so it sat visibly
            off-centre inside the first — and the animated indicator scaled up on top of both. The
            arc never animated and never tracked any progress, so the whole effect read as a
            broken double spinner rather than as decoration.
          */}
          <View
            style={{
              alignItems: 'center',
              height: theme.size['18'],
              justifyContent: 'center',
              width: theme.size['18'],
            }}
          >
            <ActivityIndicator
              // ActivityIndicator accepts 'small' | 'large' | number
              color={theme.colors.accent.primary}
              size={size === 'large' ? 'large' : 'small'}
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
