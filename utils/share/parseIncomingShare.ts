/**
 * The one entry point the receive screen uses to turn a reassembled share payload into an envelope.
 *
 * Two senders reach it: another copy of the app, which writes the envelope directly, and Musclog GB,
 * which writes a compact tuple schema it can produce with no JSON library and a few KB of RAM. The
 * cartridge form is expanded FIRST and then validated by the ordinary parser, mirroring how
 * `parseDatabaseExportJson` expands a cartridge database dump before `restoreDatabase` validates it.
 * The receiver therefore has exactly one notion of a valid share, and the expander is not trusted
 * any further than the wire is.
 */

import {
  gameBoyDayShareToEnvelope,
  isGameBoyDayShareJson,
  parseGameBoyDayShare,
} from '@/utils/optical/gameBoyDayShare';
import { GameBoyExportError } from '@/utils/optical/gameBoyExport';
import {
  type MusclogShareEnvelope,
  MusclogShareError,
  validateShareEnvelope,
} from '@/utils/share/shareEnvelope';

export function parseIncomingShareJson(json: string): MusclogShareEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new MusclogShareError('malformed', 'Share payload is not valid JSON');
  }

  if (!isGameBoyDayShareJson(parsed)) {
    return validateShareEnvelope(parsed);
  }

  try {
    return validateShareEnvelope(gameBoyDayShareToEnvelope(parseGameBoyDayShare(parsed)));
  } catch (error) {
    // A cartridge whose schema version this build does not know is the same situation as an
    // envelope from a newer app: the phone is behind, and the receive screen says so. Anything else
    // is a broken payload, which is a different sentence entirely — see `opticalReceiveScreen.ts`.
    if (error instanceof GameBoyExportError) {
      throw new MusclogShareError(
        error.code === 'unsupported-version' ? 'unsupported-kind' : 'malformed',
        error.message
      );
    }
    throw error;
  }
}
