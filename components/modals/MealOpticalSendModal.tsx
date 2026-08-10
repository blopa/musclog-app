import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildMealSharePayload } from '@/database/share/buildMealShare';

import { ShareOpticalSendModal } from './ShareOpticalSendModal';

interface MealOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  hasImage: boolean;
}

/** Sends a saved meal (a recipe from My Meals). */
export function MealOpticalSendModal({
  visible,
  onClose,
  mealId,
  hasImage,
}: MealOpticalSendModalProps) {
  const { t } = useTranslation();
  const buildPayload = useCallback(
    ({ includeImage }: { includeImage: boolean }) =>
      buildMealSharePayload(mealId, { includeImage }),
    [mealId]
  );
  const copy = useMemo(
    () => ({
      instructions: t('opticalTransfer.share.sendMealInstructions'),
      readyTitle: t('opticalTransfer.share.sendMealReadyTitle'),
      title: t('opticalTransfer.share.sendMealTitle'),
    }),
    [t]
  );

  return (
    <ShareOpticalSendModal
      buildPayload={buildPayload}
      copy={copy}
      hasImage={hasImage}
      onClose={onClose}
      visible={visible}
    />
  );
}
