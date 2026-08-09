import {
  resolveOpticalReceiveScreen,
  type OpticalReceiveScreenInput,
} from '@/components/modals/opticalReceiveScreen';
import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import {
  OPTICAL_PAYLOAD_KIND_DATABASE,
  OPTICAL_PAYLOAD_KIND_SHARE,
  type OpticalContainerMeta,
} from '@/utils/optical/container';
import type { MusclogShareEnvelope } from '@/utils/share/shareEnvelope';

const meta = (overrides: Partial<OpticalContainerMeta> = {}): OpticalContainerMeta => ({
  bodyLen: 100,
  cipherId: 0,
  cipherIv: new Uint8Array(16),
  containerVersion: 1,
  createdAtSec: 1_700_000_000,
  encrypted: false,
  exportVersion: CURRENT_DATABASE_VERSION,
  gzip: false,
  kdfId: 0,
  kdfIterations: 0,
  kdfSalt: new Uint8Array(16),
  payloadKind: OPTICAL_PAYLOAD_KIND_DATABASE,
  plainLen: 100,
  sha256: new Uint8Array(32),
  ...overrides,
});

const resolve = (input: Partial<OpticalReceiveScreenInput>) =>
  resolveOpticalReceiveScreen({ accept: 'any', phase: 'collecting', ...input });

const envelope = { kind: 'meal' } as unknown as MusclogShareEnvelope;

describe('resolveOpticalReceiveScreen', () => {
  it('shows the scanner while collecting', () => {
    expect(resolve({ phase: 'collecting' })).toEqual({ kind: 'scanning' });
  });

  it('refuses a database payload when the caller only accepts a meal', () => {
    // A food camera must never offer a full restore: that wipes the phone.
    expect(resolve({ accept: 'share', meta: meta(), phase: 'verified' })).toEqual({
      kind: 'refused',
      reason: 'not-a-meal',
    });
  });

  it('refuses an unrecognised payload kind from any entry point', () => {
    expect(resolve({ meta: meta({ payloadKind: 99 }), phase: 'verified' })).toEqual({
      kind: 'refused',
      reason: 'unknown-payload',
    });
  });

  it('lets a refusal outrank every later phase', () => {
    // The refusal used to be a separate block that both the unpacking and passphrase branches had
    // to negate by hand. Precedence now lives in one place.
    for (const phase of ['unpacking', 'passphrase', 'verified'] as const) {
      expect(resolve({ accept: 'share', meta: meta(), phase }).kind).toBe('refused');
    }
  });

  it('reports a wrong passphrase distinctly from a first prompt', () => {
    expect(resolve({ phase: 'passphrase', errorCode: 'needs-passphrase' })).toEqual({
      kind: 'passphrase',
      wrongPassphrase: false,
    });
    expect(resolve({ phase: 'passphrase', errorCode: 'bad-passphrase' })).toEqual({
      kind: 'passphrase',
      wrongPassphrase: true,
    });
  });

  it('gates a restore on the export version', () => {
    const current = meta({ exportVersion: CURRENT_DATABASE_VERSION });
    const newer = meta({ exportVersion: CURRENT_DATABASE_VERSION + 1 });

    expect(resolve({ meta: current, phase: 'verified' })).toEqual({
      kind: 'database',
      meta: current,
      tooNew: false,
    });
    expect(resolve({ meta: newer, phase: 'verified' })).toMatchObject({ tooNew: true });
  });

  it('offers a parsed share envelope', () => {
    expect(
      resolve({
        meta: meta({ payloadKind: OPTICAL_PAYLOAD_KIND_SHARE }),
        parsedShare: { envelope },
        phase: 'verified',
      })
    ).toEqual({ kind: 'share', envelope });
  });

  it.each([
    ['unsupported-envelope', true],
    ['unsupported-kind', true],
    ['malformed', false],
    ['not-a-share', false],
    ['too-large', false],
  ] as const)('maps share failure %s to tooNew=%s', (code, tooNew) => {
    // Only "this build is behind" codes may say "update the other phone". Saying it for a broken
    // payload sends the user chasing a version mismatch that does not exist — the v2.11.0 bug.
    expect(
      resolve({
        meta: meta({ payloadKind: OPTICAL_PAYLOAD_KIND_SHARE }),
        parsedShare: { code },
        phase: 'verified',
      })
    ).toEqual({ kind: 'share-unreadable', tooNew });
  });

  it('distinguishes a checksum failure from a generic error', () => {
    expect(resolve({ phase: 'error', errorCode: 'checksum-failed' })).toEqual({
      kind: 'error',
      checksumFailed: true,
    });
    expect(resolve({ phase: 'error', errorCode: 'bad-magic' })).toEqual({
      kind: 'error',
      checksumFailed: false,
    });
  });

  it('never resolves verified-without-metadata to a blank screen', () => {
    expect(resolve({ phase: 'verified' })).toEqual({ kind: 'error', checksumFailed: false });
  });
});
