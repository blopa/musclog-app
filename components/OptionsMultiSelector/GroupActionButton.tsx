import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link2, Unlink } from 'lucide-react-native';
import { theme } from '../../theme';

type GroupActionButtonProps = {
  onPress: () => void;
  allSelectedInSameGroup: boolean;
};

export const GroupActionButton: React.FC<GroupActionButtonProps> = ({
  onPress,
  allSelectedInSameGroup,
}) => {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.padding.xs,
        zIndex: 2000,
      }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.gap.sm,
            paddingHorizontal: theme.spacing.padding.base,
            paddingVertical: theme.spacing.padding.xs,
            borderRadius: theme.borderRadius.full,
            backgroundColor: allSelectedInSameGroup
              ? theme.colors.status.error
              : theme.colors.accent.primary,
            ...theme.shadows.accentGlow,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            shadowColor: allSelectedInSameGroup
              ? theme.colors.status.error
              : theme.colors.accent.primary,
          },
        ]}>
        {allSelectedInSameGroup ? (
          <>
            <Unlink size={14} color={theme.colors.text.white} />
            <Text
              style={{
                color: theme.colors.text.white,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: 11,
              }}>
              Ungroup
            </Text>
          </>
        ) : (
          <>
            <Link2 size={14} color={theme.colors.text.white} />
            <Text
              style={{
                color: theme.colors.text.white,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: 11,
              }}>
              Group
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};
