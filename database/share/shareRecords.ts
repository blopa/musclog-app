/**
 * The row-level plumbing every share builder needs: turning a WatermelonDB model into a wire row,
 * and deciding what happens to an image column.
 *
 * Lives beside the builders rather than inside one of them because the meal builder and the food
 * builder must agree exactly — a food row carried as a meal's ingredient and the same food row sent
 * on its own have to sanitize and image-handle identically, or the receiver's dedupe compares two
 * different shapes of the same food.
 */

import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import { createThumbnail } from '@/utils/file';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import {
  type MusclogShareEnvelope,
  SHARE_ASSET_REF_PREFIX,
  type ShareAsset,
  type ShareRow,
} from '@/utils/share/shareEnvelope';

const SHARE_THUMBNAIL_WIDTH = 400;

/**
 * What became of the record's photo while the payload was built.
 *
 * The size readout cannot express this, which is what made the photo toggle look broken: a linked
 * photo adds ~90 bytes to a payload measured in KB, so the number does not move — and a photo whose
 * file has gone missing is dropped silently, which does not move it either. Three materially
 * different outcomes, one unchanged "1 KB to transfer". The send screen states which one happened
 * rather than leaving the user to infer it from a byte count that cannot show it.
 *
 * Sender-local, never on the wire: the receiver can see for itself whether an asset arrived.
 */
export type SharePhotoOutcome =
  /** A thumbnail is embedded in the payload. The only outcome that costs real transfer time. */
  | 'embedded'
  /** A URL both phones can fetch rides along. Costs ~90 bytes; the receiver needs a connection. */
  | 'linked'
  /** Nothing to send: no photo on the record, or the sender opted out. */
  | 'none'
  /** There is a photo, but its file could not be read. Nothing is sent, and nobody was told. */
  | 'unavailable';

/**
 * A built envelope plus what happened to its photo — the two things the sender screen needs.
 *
 * The outcome cannot be recovered from the envelope alone: `summary.hasImage: false` covers both
 * "there was no photo" and "the photo file could not be read", and only the second is worth telling
 * the user about. So the builder that ran `prepareShareImage` reports it rather than leaving the UI
 * to guess.
 */
export interface ShareBuild<TEnvelope extends MusclogShareEnvelope = MusclogShareEnvelope> {
  envelope: TEnvelope;
  photo: SharePhotoOutcome;
}

/**
 * A built envelope as the optical sender wants it.
 *
 * Every kind's builder ended in a byte-identical copy of this, which is three chances to disagree
 * about the container fields that make a payload a share rather than a database — and the receive
 * side refuses to act on a payload whose `payloadKind` it does not recognise, so a divergence here
 * fails on the OTHER phone.
 */
export function shareSenderPayload(build: ShareBuild) {
  return {
    exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
    json: JSON.stringify(build.envelope),
    payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
    photo: build.photo,
  };
}

/**
 * A model's raw columns, minus WatermelonDB's sync bookkeeping and every empty value. The empties
 * are dropped because they cost frames for nothing — an absent column and a `null` one both read
 * back as unset on the receiver.
 */
export function shareRow(model: { id: string; _raw?: Record<string, unknown> }): ShareRow {
  const raw = { ...(model._raw ?? {}), id: model.id };
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) =>
        !['_changed', '_status', 'deleted_at'].includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== ''
    )
  );
}

export function isActive(model: { deletedAt?: number } | null | undefined): boolean {
  return Boolean(model && model.deletedAt == null);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The food's default portion and the junction row that marks it. Carried by every kind that sends a
 * food, so the receiver's new copy opens with the same serving size the sender sees rather than
 * falling back to raw grams. A broken link is not fatal — the food is still worth sending.
 */
export async function defaultPortionLink(
  food: Food
): Promise<{ link: FoodFoodPortion; portion: FoodPortion } | undefined> {
  try {
    const links = await food.foodPortions.fetch();
    for (const link of links) {
      if (link.isDefault && isActive(link)) {
        const portion = await link.foodPortion;
        if (isActive(portion)) {
          return { link, portion };
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * WatermelonDB reads an unset optional column back as `null`, not `undefined`, whatever the
 * model's `?: number` typing claims — and `JSON.stringify` keeps a null while it drops an
 * undefined. Every optional number that reaches a summary goes through this, so the envelope
 * omits the field rather than carrying an explicit null that the receiver's validator rejects.
 */
export function optionalNumber(value: null | number | undefined): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

/** An image the receiver can fetch for itself, as opposed to a path on the sender's filesystem. */
export function isRemoteImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export interface PreparedShareImage {
  /** What to write into the row's image column; `undefined` means carry no image at all. */
  value?: string;
  asset?: ShareAsset;
  outcome: SharePhotoOutcome;
}

/**
 * Resolves a record's own photo for the wire.
 *
 * A remote URL rides along as a string — ~90 bytes, and the receiver fetches the same picture the
 * sender sees. A local path has to be embedded as an asset, because the path itself means nothing
 * on the other phone. If the file is gone the share still goes, without the photo: a missing
 * thumbnail is not a reason to refuse to send a meal — but it IS reported, because a silently
 * photo-less share is indistinguishable on screen from one that worked.
 */
export async function prepareShareImage(
  imageUrl: null | string | undefined,
  assetId: string,
  includeImage: boolean
): Promise<PreparedShareImage> {
  if (!includeImage || !imageUrl) {
    return { outcome: 'none' };
  }

  if (isRemoteImageUrl(imageUrl)) {
    return { outcome: 'linked', value: imageUrl };
  }

  try {
    const thumbnail = await createThumbnail(imageUrl, SHARE_THUMBNAIL_WIDTH);
    if (!thumbnail.base64) {
      return { outcome: 'unavailable' };
    }

    return {
      asset: {
        base64: thumbnail.base64,
        height: thumbnail.height,
        mime: 'image/jpeg',
        width: thumbnail.width,
      },
      outcome: 'embedded',
      value: `${SHARE_ASSET_REF_PREFIX}${assetId}`,
    };
  } catch {
    return { outcome: 'unavailable' };
  }
}

/** Writes a prepared image onto a row, removing the column when there is no image to carry. */
export function applyShareImage(row: ShareRow, column: string, image: PreparedShareImage): void {
  if (image.value) {
    row[column] = image.value;
  } else {
    delete row[column];
  }
}

/**
 * A food carried as part of ANOTHER record's share — a meal's ingredients — never embeds a photo of
 * its own: a recipe with twenty ingredients would otherwise blow the asset budget and the transfer
 * time on pictures nobody asked for. A remote URL still rides along when the sender chose to
 * include photos, and a sender-local file path is always dropped, because carrying it would leave
 * the receiver with a food pointing at a file that does not exist.
 */
export function applyCarriedFoodImage(row: ShareRow, includeImage: boolean): void {
  const url = typeof row.image_url === 'string' ? row.image_url : undefined;
  if (!url || !includeImage || !isRemoteImageUrl(url)) {
    delete row.image_url;
  }
}
