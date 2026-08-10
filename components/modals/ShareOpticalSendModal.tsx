import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type NutritionLog from '@/database/models/NutritionLog';
import { buildFoodSharePayload } from '@/database/share/buildFoodShare';
import { buildLoggedMealSharePayload } from '@/database/share/buildLoggedMealShare';
import { buildMealSharePayload } from '@/database/share/buildMealShare';
import { MusclogShareError } from '@/utils/share/shareEnvelope';

import { OpticalSendModal } from './OpticalSendModal';

/**
 * What is being sent. A tagged union rather than a component per kind: the three used to be
 * separate wrapper files that differed only in which builder they called and which three
 * translation keys they picked — and two of them picked the SAME three keys. Each was ~46 lines of
 * `useCallback` + `useMemo` around one function call, which is a modal layer bought with nothing.
 */
export type ShareSendTarget =
  | { kind: 'food'; foodId: string; hasImage: boolean }
  /** A saved recipe from My Meals. */
  | { kind: 'meal'; mealId: string; hasImage: boolean }
  /**
   * A meal the user logged (a diary section), sent as a meal the receiver can save. No photo
   * option: a logged meal has no photo of its own, and its ingredients' photos are not what the
   * user asked to send.
   */
  | { kind: 'loggedMeal'; logs: NutritionLog[]; name: string };

/**
 * Title / ready-title / instructions per kind. A logged meal is presented as a meal because that
 * is what the receiver ends up with — `buildLoggedMealShare` synthesizes a `meals` row and reuses
 * `MEAL_SHARE_SPEC` end to end — so it deliberately shares the meal copy rather than owning a
 * duplicate set of keys that would have to be translated five times to say the same thing.
 */
const SHARE_COPY_KEYS = {
  food: {
    instructions: 'opticalTransfer.share.sendFoodInstructions',
    readyTitle: 'opticalTransfer.share.sendFoodReadyTitle',
    title: 'opticalTransfer.share.sendFoodTitle',
  },
  loggedMeal: {
    instructions: 'opticalTransfer.share.sendMealInstructions',
    readyTitle: 'opticalTransfer.share.sendMealReadyTitle',
    title: 'opticalTransfer.share.sendMealTitle',
  },
  meal: {
    instructions: 'opticalTransfer.share.sendMealInstructions',
    readyTitle: 'opticalTransfer.share.sendMealReadyTitle',
    title: 'opticalTransfer.share.sendMealTitle',
  },
} as const satisfies Record<
  ShareSendTarget['kind'],
  { title: string; readyTitle: string; instructions: string }
>;

/** Only a food or a saved meal has a photo of its own to offer. */
function targetHasImage(target: ShareSendTarget): boolean {
  return target.kind === 'loggedMeal' ? false : target.hasImage;
}

function buildTargetPayload(target: ShareSendTarget, includeImage: boolean) {
  switch (target.kind) {
    case 'food':
      return buildFoodSharePayload(target.foodId, { includeImage });
    case 'meal':
      return buildMealSharePayload(target.mealId, { includeImage });
    case 'loggedMeal':
      return buildLoggedMealSharePayload(target.logs, { name: target.name });
  }
}

interface ShareOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  target: ShareSendTarget;
}

/**
 * The send screen for one shared record, whatever the record is.
 *
 * What lives here is the part that must not diverge between kinds: translating the builder's typed
 * "nothing to send" failure. It is matched on the code, never on the message text, because the
 * send screen renders whatever the builder throws and a reworded English string used to drop the
 * user into a generic failure with no way to tell what was wrong.
 */
export function ShareOpticalSendModal({ visible, onClose, target }: ShareOpticalSendModalProps) {
  const { t } = useTranslation();

  const build = useCallback(
    async ({ includeImage }: { includeImage: boolean }) => {
      try {
        return await buildTargetPayload(target, includeImage);
      } catch (error) {
        if (error instanceof MusclogShareError && error.code === 'no-ingredients') {
          throw new Error(t('opticalTransfer.share.noIngredients'));
        }
        throw error;
      }
    },
    [target, t]
  );

  const copy = SHARE_COPY_KEYS[target.kind];
  const labels = useMemo(
    () => ({
      buildingStep: t('opticalTransfer.share.buildingStep'),
      instructions: t(copy.instructions),
      readyTitle: t(copy.readyTitle),
      title: t(copy.title),
    }),
    [copy, t]
  );

  return (
    <OpticalSendModal
      buildPayload={build}
      copy={labels}
      hasPhoto={targetHasImage(target)}
      onClose={onClose}
      visible={visible}
    />
  );
}
