import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildFoodSharePayload } from '@/database/share/buildFoodShare';

import { ShareOpticalSendModal } from './ShareOpticalSendModal';

interface FoodOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  foodId: string;
  hasImage: boolean;
}

/** Sends one food and the portions linked to it. */
export function FoodOpticalSendModal({
  visible,
  onClose,
  foodId,
  hasImage,
}: FoodOpticalSendModalProps) {
  const { t } = useTranslation();
  const buildPayload = useCallback(
    ({ includeImage }: { includeImage: boolean }) =>
      buildFoodSharePayload(foodId, { includeImage }),
    [foodId]
  );
  const copy = useMemo(
    () => ({
      instructions: t('opticalTransfer.share.sendFoodInstructions'),
      readyTitle: t('opticalTransfer.share.sendFoodReadyTitle'),
      title: t('opticalTransfer.share.sendFoodTitle'),
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
