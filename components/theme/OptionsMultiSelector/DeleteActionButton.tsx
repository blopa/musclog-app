import { Trash2 } from 'lucide-react-native';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../../hooks/useTheme';

type DeleteActionButtonProps = {
  onPress: () => void;
  selectedCount: number;
};

export const DeleteActionButton: FC<DeleteActionButtonProps> = ({ onPress, selectedCount }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const errorBg = theme.colors.status.error;

  return (
    <View
      style={{
        alignSelf: 'stretch',
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        backgroundColor: errorBg,
        borderWidth: theme.borderWidth.medium,
        borderColor: errorBg,
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
              ? t('optionsSelector.deleteExercise')
              : t('optionsSelector.deleteExercises')}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
