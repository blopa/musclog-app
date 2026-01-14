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
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3,
      }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: 0.5 }}
        />
        <View
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: 0.5 }}
        />
      </View>
      <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: 0.5 }}
        />
        <View
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: 0.5 }}
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
        zIndex: 2000,
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
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: allSelectedInSameGroup ? '#7f1d1d' : '#064e3b', // Darker border
            backgroundColor: allSelectedInSameGroup
              ? '#ef4444' // Vibrant red for ungroup
              : '#10b981', // Vibrant emerald for group
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 3,
          },
        ]}>
        <ActionIcon color={theme.colors.text.white} />
        <Text
          style={{
            color: theme.colors.text.white,
            fontWeight: '900',
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
          }}>
          {allSelectedInSameGroup ? t('optionsSelector.unlink') : t('optionsSelector.link')}
        </Text>
      </Pressable>
    </View>
  );
};
