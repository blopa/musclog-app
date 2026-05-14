import { Calculator, PenLine, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import { GoalOptionItem } from './GoalOptionItem';

type GoalCreationMethodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectGuided: () => void;
  onSelectAutoCalculate: () => void;
};

export function GoalCreationMethodModal({
  visible,
  onClose,
  onSelectManual,
  onSelectGuided,
  onSelectAutoCalculate,
}: GoalCreationMethodModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('goalsManagement.goalCreationMethod.title')}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.secondary,
            marginBottom: 8,
          }}
        >
          {t('goalsManagement.goalCreationMethod.subtitle')}
        </Text>

        {/* Guided option — recommended */}
        <GoalOptionItem
          icon={<Sparkles size={theme.iconSize.md} color={theme.colors.accent.primary} />}
          title={t('goalsManagement.goalCreationMethod.guidedTitle')}
          description={t('goalsManagement.goalCreationMethod.guidedDescription')}
          onPress={onSelectGuided}
          isRecommended={true}
          recommendedText={t('goalsManagement.goalCreationMethod.recommended')}
        />

        {/* Auto-calculate option */}
        <GoalOptionItem
          icon={<Calculator size={theme.iconSize.md} color={theme.colors.text.secondary} />}
          title={t('goalsManagement.goalCreationMethod.autoCalculateTitle')}
          description={t('goalsManagement.goalCreationMethod.autoCalculateDescription')}
          onPress={onSelectAutoCalculate}
        />

        {/* Manual option */}
        <GoalOptionItem
          icon={<PenLine size={theme.iconSize.md} color={theme.colors.text.secondary} />}
          title={t('goalsManagement.goalCreationMethod.manualTitle')}
          description={t('goalsManagement.goalCreationMethod.manualDescription')}
          onPress={onSelectManual}
        />
      </View>
    </FullScreenModal>
  );
}
