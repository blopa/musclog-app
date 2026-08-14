import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type NutritionLog from '@/database/models/NutritionLog';
import { buildFoodSharePayload } from '@/database/share/buildFoodShare';
import { buildLoggedMealSharePayload } from '@/database/share/buildLoggedMealShare';
import { buildMealSharePayload } from '@/database/share/buildMealShare';
import { buildNutritionDaySharePayload } from '@/database/share/buildNutritionDayShare';
import type { SharePhotoOutcome } from '@/database/share/shareRecords';
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
  | { kind: 'loggedMeal'; logs: NutritionLog[]; name: string }
  /**
   * One calendar day of the diary, sent as diary entries rather than as a recipe: the receiver
   * files it on the same date, with each entry's amount, meal type and time intact. Musclog GB's
   * `SHARE DAY` produces the same payload, so both land on one receive screen.
   */
  | { kind: 'nutritionDay'; logs: NutritionLog[]; dayKey: string };

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
  nutritionDay: {
    instructions: 'opticalTransfer.share.sendDayInstructions',
    readyTitle: 'opticalTransfer.share.sendDayReadyTitle',
    title: 'opticalTransfer.share.sendDayTitle',
  },
} as const satisfies Record<
  ShareSendTarget['kind'],
  { title: string; readyTitle: string; instructions: string }
>;

/**
 * What to say under the photo toggle for each outcome a build can reach.
 *
 * All three are worth a sentence because none of them are visible in the size readout, which is
 * what made the toggle look broken: only `embedded` moves the number, `linked` costs ~90 bytes,
 * and `unavailable` costs nothing and silently sends no photo at all. `none` says nothing — either
 * there is no photo or the user turned it off, and both are already on screen.
 *
 * Held as `labelKey` fields rather than inside literal `t('…')` calls so `check-translations`
 * still sees them, the same way `components/coach/coachIntentions.ts` does.
 */
const SHARE_PHOTO_NOTICE = {
  embedded: { labelKey: 'opticalTransfer.share.photoEmbedded' },
  linked: { labelKey: 'opticalTransfer.share.photoLinked' },
  none: undefined,
  unavailable: { labelKey: 'opticalTransfer.share.photoUnavailable' },
} as const satisfies Record<SharePhotoOutcome, undefined | { labelKey: string }>;

/** Only a food or a saved meal has a photo of its own to offer. */
function targetHasImage(target: ShareSendTarget): boolean {
  return target.kind === 'food' || target.kind === 'meal' ? target.hasImage : false;
}

function buildTargetPayload(target: ShareSendTarget, includeImage: boolean) {
  switch (target.kind) {
    case 'food':
      return buildFoodSharePayload(target.foodId, { includeImage });
    case 'meal':
      return buildMealSharePayload(target.mealId, { includeImage });
    case 'loggedMeal':
      return buildLoggedMealSharePayload(target.logs, { name: target.name });
    case 'nutritionDay':
      return buildNutritionDaySharePayload(target.logs, { dayKey: target.dayKey });
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
 * What lives here is the part that must not diverge between kinds, and that the generic send screen
 * cannot own because it also sends whole databases: translating the builder's typed "nothing to
 * send" failure, and saying what became of the record's photo. The failure is matched on the code,
 * never on the message text, because the send screen renders whatever the builder throws and a
 * reworded English string used to drop the user into a generic failure with no way to tell what was
 * wrong.
 */
export function ShareOpticalSendModal({ visible, onClose, target }: ShareOpticalSendModalProps) {
  const { t } = useTranslation();

  const [photo, setPhoto] = useState<SharePhotoOutcome>('none');
  /**
   * Bumped per build for the same reason `useOpticalSender` bumps its own: toggling the photo twice
   * quickly leaves two builds in flight, and the sender drops the stale one's size — so publishing
   * the stale one's outcome here would caption the wrong payload.
   */
  const buildGeneration = useRef(0);

  const build = useCallback(
    async ({ includeImage }: { includeImage: boolean }) => {
      const generation = ++buildGeneration.current;
      try {
        const payload = await buildTargetPayload(target, includeImage);
        if (buildGeneration.current === generation) {
          setPhoto(payload.photo);
        }
        return payload;
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

  const notice = SHARE_PHOTO_NOTICE[photo];

  return (
    <OpticalSendModal
      buildPayload={build}
      copy={labels}
      hasPhoto={targetHasImage(target)}
      onClose={onClose}
      photoNotice={notice ? t(notice.labelKey) : undefined}
      visible={visible}
    />
  );
}
