import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUp } from '../BottomPopUp';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { Button } from '../theme/Button';

type ScaleMealPortionModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (totalGrams: number) => Promise<void>;
  initialTotalGrams: number;
  isLoading?: boolean;
};

export function ScaleMealPortionModal({
  visible,
  onClose,
  onConfirm,
  initialTotalGrams,
  isLoading = false,
}: ScaleMealPortionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [targetGrams, setTargetGrams] = useState(initialTotalGrams);

  useEffect(() => {
    if (visible) {
      setTargetGrams(initialTotalGrams);
    }
  }, [visible, initialTotalGrams]);

  const handleConfirm = async () => {
    if (isLoading || targetGrams < 1) {
      return;
    }
    await onConfirm(targetGrams);
  };

  const isUnchanged = Math.abs(targetGrams - initialTotalGrams) < 0.5;

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('food.actions.scaleMealPortionModalTitle')}
      subtitle={t('food.actions.scaleMealPortionModalSubtitle')}
      footer={
        <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
          <Button
            label={t('common.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
            disabled={isLoading}
          />
          <Button
            label={t('common.confirm')}
            variant="gradientCta"
            size="sm"
            width="flex-1"
            onPress={handleConfirm}
            disabled={isLoading || targetGrams < 1 || isUnchanged}
            loading={isLoading}
          />
        </View>
      }
    >
      <ServingSizeSelector value={targetGrams} onChange={setTargetGrams} />
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
    </BottomPopUp>
  );
}
