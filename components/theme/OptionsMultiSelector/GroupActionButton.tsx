import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../theme';

type GroupActionButtonProps = {
  onPress: () => void;
  allSelectedInSameGroup: boolean;
};

export const GroupActionButton: React.FC<GroupActionButtonProps> = ({
  onPress,
  allSelectedInSameGroup,
}) => {
  const { t } = useTranslation();
  // Custom icon to match the image (4 dots with a horizontal line)
  const ActionIcon = ({ color }: { color: string }) => (
    <View
      style={{
        width: theme.iconSize.sm + 2,
        height: theme.iconSize.sm + 2,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing.gap.xs,
      }}>
      <View style={{ flexDirection: 'row', gap: theme.size.xs }}>
        <View
          style={{
            width: theme.size.xs,
            height: theme.size.xs,
            borderRadius: theme.borderRadius['2'],
            backgroundColor: color,
            opacity: theme.colors.opacity.medium,
          }}
        />
        <View
          style={{
            width: theme.size.xs,
            height: theme.size.xs,
            borderRadius: theme.borderRadius['2'],
            backgroundColor: color,
            opacity: theme.colors.opacity.medium,
          }}
        />
      </View>
      <View
        style={{
          width: theme.size.base,
          height: theme.size['2'] / 4,
          backgroundColor: color,
          borderRadius: theme.borderRadius['2'],
        }}
      />
      <View style={{ flexDirection: 'row', gap: theme.size.xs }}>
        <View
          style={{
            width: theme.size.xs,
            height: theme.size.xs,
            borderRadius: theme.borderRadius['2'],
            backgroundColor: color,
            opacity: theme.colors.opacity.medium,
          }}
        />
        <View
          style={{
            width: theme.size.xs,
            height: theme.size.xs,
            borderRadius: theme.borderRadius['2'],
            backgroundColor: color,
            opacity: theme.colors.opacity.medium,
          }}
        />
      </View>
    </View>
  );

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.padding.md,
        zIndex: theme.zIndex.max,
        width: '100%',
      }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.gap.sm,
            width: '100%',
            paddingVertical: theme.spacing.padding.sm,
            borderRadius: theme.borderRadius.xs,
            borderWidth: theme.borderWidth.medium,
            borderColor: allSelectedInSameGroup
              ? theme.colors.status.redDark
              : theme.colors.status.emeraldDark,
            backgroundColor: allSelectedInSameGroup
              ? theme.colors.status.errorSolid
              : theme.colors.status.emeraldSolid,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: theme.colors.text.black,
            shadowOffset: theme.shadowOffset.md,
            shadowOpacity: theme.colors.opacity.subtle,
            shadowRadius: theme.shadows.radius3.shadowRadius,
            elevation: theme.elevation.md,
          },
        ]}>
        <ActionIcon color={theme.colors.text.white} />
        <Text
          style={{
            color: theme.colors.text.white,
            fontWeight: theme.typography.fontWeight.black,
            fontSize: theme.typography.fontSize.sm,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.extraWide,
          }}>
          {allSelectedInSameGroup ? t('optionsSelector.unlink') : t('optionsSelector.link')}
        </Text>
      </Pressable>
    </View>
  );
};
