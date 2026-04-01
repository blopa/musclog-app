import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../../hooks/useTheme';

type GroupActionButtonProps = {
  onPress: () => void;
  allSelectedInSameGroup: boolean;
};

export const GroupActionButton: FC<GroupActionButtonProps> = ({
  onPress,
  allSelectedInSameGroup,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const isUngroup = allSelectedInSameGroup;
  const backgroundColor = isUngroup
    ? theme.colors.status.errorSolid
    : theme.colors.status.emeraldSolid;
  const borderColor = isUngroup ? theme.colors.status.redDark : theme.colors.status.emeraldDark;

  // Custom icon to match the image (4 dots with a horizontal line)
  const ActionIcon = ({ color }: { color: string }) => (
    <View
      style={{
        width: theme.iconSize.sm + 2,
        height: theme.iconSize.sm + 2,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing.gap.xs,
      }}
    >
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
        alignSelf: 'stretch',
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        backgroundColor,
        borderWidth: theme.borderWidth.medium,
        borderColor,
        shadowColor: theme.colors.text.black,
        shadowOffset: theme.shadowOffset.md,
        shadowOpacity: theme.colors.opacity.subtle,
        shadowRadius: theme.shadows.radius3.shadowRadius,
        elevation: theme.elevation.md,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={{
          alignSelf: 'stretch',
          paddingVertical: theme.spacing.padding.sm,
          paddingHorizontal: theme.spacing.padding.md,
        }}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.gap.sm,
          }}
        >
          <ActionIcon color={theme.colors.text.white} />
          <Text
            style={{
              color: theme.colors.text.white,
              fontWeight: theme.typography.fontWeight.black,
              fontSize: theme.typography.fontSize.sm,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
            }}
          >
            {isUngroup ? t('optionsSelector.unlink') : t('optionsSelector.link')}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
