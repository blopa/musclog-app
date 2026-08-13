/**
 * Optical transfer — which screen the receive modal is showing.
 *
 * The receive flow is genuinely a state machine: a transfer is being collected, or verified, or
 * asking for a passphrase, or offering a restore, or refusing a payload it will not touch. The
 * modal used to render it as seven independent `{cond ? … : null}` blocks whose mutual exclusion
 * was maintained by hand — two of them carried `&& !databaseRefused && !unknownPayload`, a
 * negation list that had to grow by one term every time a screen was added, and nothing stopped
 * two arms rendering at once.
 *
 * Resolving it to one tagged union means the modal renders exactly one arm, the impossible
 * combinations cannot be expressed, and this precedence is testable without a renderer — which is
 * why it lives in a `.ts` beside the modal rather than inside it.
 */

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import type { OpticalReceiverPhase, OpticalReceiverState } from '@/hooks/useOpticalReceiver';
import {
  OPTICAL_PAYLOAD_KIND_DATABASE,
  OPTICAL_PAYLOAD_KIND_SHARE,
  type OpticalContainerMeta,
} from '@/utils/optical/container';
import type { MusclogShareEnvelope, MusclogShareErrorCode } from '@/utils/share/shareEnvelope';

/** Outcome of parsing the reassembled JSON as a share envelope. */
export type ParsedShare =
  | { envelope: MusclogShareEnvelope; code?: undefined }
  | { code: MusclogShareErrorCode; envelope?: undefined };

export interface OpticalReceiveScreenInput {
  phase: OpticalReceiverPhase;
  meta?: OpticalContainerMeta;
  /**
   * `'database'` when onboarding will only accept a full backup, or `'share'` when a food camera
   * will only accept a shared record (a meal, a food). These entry points must not expose actions
   * that depend on app state the user has not reached, or offer a wipe from a food scanner.
   */
  accept: 'any' | 'database' | 'share';
  errorCode?: OpticalReceiverState['errorCode'];
  parsedShare?: ParsedShare;
}

export type OpticalReceiveScreen =
  | { kind: 'scanning' }
  /** A payload this entry point will not act on. Nothing has been written. */
  | { kind: 'refused'; reason: 'database' | 'share' | 'unknown-payload' }
  | { kind: 'unpacking' }
  | { kind: 'passphrase'; wrongPassphrase: boolean }
  | { kind: 'database'; meta: OpticalContainerMeta; tooNew: boolean }
  | { kind: 'share'; envelope: MusclogShareEnvelope }
  | { kind: 'share-unreadable'; tooNew: boolean }
  | { kind: 'error'; checksumFailed: boolean };

/**
 * Only these two failure codes mean "the sender is ahead of this build". The rest are a broken or
 * unreadable payload, and telling the user to update a phone that is already up to date sends
 * them chasing a version mismatch that does not exist — which is exactly what a v2.11.0-to-v2.11.0
 * meal share did.
 */
function shareErrorMeansTooNew(code?: MusclogShareErrorCode): boolean {
  return code === 'unsupported-envelope' || code === 'unsupported-kind';
}

export function resolveOpticalReceiveScreen(
  input: OpticalReceiveScreenInput
): OpticalReceiveScreen {
  const { accept, errorCode, meta, parsedShare, phase } = input;
  const isDatabase = meta?.payloadKind === OPTICAL_PAYLOAD_KIND_DATABASE;
  const isShare = meta?.payloadKind === OPTICAL_PAYLOAD_KIND_SHARE;

  // Refusal outranks every later phase: once the header names a payload this entry point will not
  // act on, there is nothing to unpack, verify or offer.
  if (meta) {
    if (accept === 'share' && isDatabase) {
      return { kind: 'refused', reason: 'database' };
    }

    if (accept === 'database' && isShare) {
      return { kind: 'refused', reason: 'share' };
    }

    if (!isDatabase && !isShare) {
      return { kind: 'refused', reason: 'unknown-payload' };
    }
  }

  switch (phase) {
    case 'collecting':
      return { kind: 'scanning' };
    case 'unpacking':
      return { kind: 'unpacking' };
    case 'passphrase':
      return { kind: 'passphrase', wrongPassphrase: errorCode === 'bad-passphrase' };
    case 'error':
      return { kind: 'error', checksumFailed: errorCode === 'checksum-failed' };
    case 'verified':
      if (isShare) {
        return parsedShare?.envelope
          ? { kind: 'share', envelope: parsedShare.envelope }
          : { kind: 'share-unreadable', tooNew: shareErrorMeansTooNew(parsedShare?.code) };
      }

      if (meta && isDatabase) {
        // A backup written by a newer app cannot be understood by this one. Zod would eventually
        // reject it, but only after the wipe and a wall of validation errors — so refuse up front.
        return { kind: 'database', meta, tooNew: meta.exportVersion > CURRENT_DATABASE_VERSION };
      }

      // Verified with no container metadata is unreachable (`unpack` always sets it before the
      // phase moves), but a blank screen is the worst possible way to be wrong about that.
      return { kind: 'error', checksumFailed: false };
  }
}
