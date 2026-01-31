import { FC } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../theme';

type DeleteActionButtonProps = {
  onPress: () => void;
  selectedCount: number;
};

export const DeleteActionButton: FC<DeleteActionButtonProps> = ({ onPress, selectedCount }) => {
  const { t } = useTranslation();

  return (
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
          borderColor: theme.colors.status.error,
          backgroundColor: theme.colors.status.error,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          shadowColor: theme.colors.text.black,
          shadowOffset: theme.shadowOffset.md,
          shadowOpacity: theme.colors.opacity.subtle,
          shadowRadius: theme.shadows.radius3.shadowRadius,
          elevation: theme.elevation.md,
        },
      ]}
    >
      <Trash2 size={theme.iconSize.sm} color={theme.colors.text.white} />
      <Text
        style={{
          color: theme.colors.text.white,
          fontWeight: theme.typography.fontWeight.black,
          fontSize: theme.typography.fontSize.sm,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.extraWide,
        }}
      >
        {selectedCount === 1
          ? t('optionsSelector.deleteExercise', 'Delete Exercise')
          : t('optionsSelector.deleteExercises', `Delete ${selectedCount} Exercises`)}
      </Text>
    </Pressable>
  );
};
