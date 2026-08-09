import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildMealSharePayload } from '@/database/share/buildMealShare';

import { OpticalSendModal } from './OpticalSendModal';

interface MealOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  hasImage: boolean;
}

export function MealOpticalSendModal({
  visible,
  onClose,
  mealId,
  hasImage,
}: MealOpticalSendModalProps) {
  const { t } = useTranslation();
  const buildPayload = useCallback(
    async ({ includeImage }: { includeImage: boolean }) => {
      try {
        return await buildMealSharePayload(mealId, { includeImage });
      } catch (error) {
        if (error instanceof Error && error.message.includes('without ingredients')) {
          throw new Error(t('opticalTransfer.share.noIngredients'));
        }
        throw error;
      }
    },
    [mealId, t]
  );
  const copy = useMemo(
    () => ({
      buildingStep: t('opticalTransfer.share.buildingStep'),
      instructions: t('opticalTransfer.share.sendMealInstructions'),
      readyTitle: t('opticalTransfer.share.sendMealReadyTitle'),
      title: t('opticalTransfer.share.sendMealTitle'),
    }),
    [t]
  );

  return (
    <OpticalSendModal
      buildPayload={buildPayload}
      copy={copy}
      onClose={onClose}
      photoToggle={{ available: hasImage }}
      visible={visible}
    />
  );
}
