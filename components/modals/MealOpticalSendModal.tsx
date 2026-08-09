import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildMealSharePayload } from '@/database/share/buildMealShare';
import { MusclogShareError } from '@/utils/share/shareEnvelope';

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
        // Matched on the typed code, never on the message text: the send screen renders whatever
        // this throws, so a reworded English string used to silently drop the user back to a
        // generic failure with no way to tell what was wrong.
        if (error instanceof MusclogShareError && error.code === 'no-ingredients') {
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
      hasPhoto={hasImage}
      onClose={onClose}
      visible={visible}
    />
  );
}
