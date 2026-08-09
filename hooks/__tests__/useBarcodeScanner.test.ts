/**
 * @jest-environment jsdom
 */

/**
 * The barcode scanner's optical-stream escape hatch.
 *
 * These scanners list `qr` among their code types, so a phone streaming an optical transfer feeds
 * real fountain frames straight into `handleLiveBarcodeScanned`. Frames are built with the shipping
 * encoder here — nothing about the detection path is stubbed — because the whole point is that a
 * frame must never reach the food lookup.
 */

import { act, renderHook } from '@testing-library/react';

import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { base44Encode } from '@/utils/optical/base44';
import { type FrameHeader, packFrame } from '@/utils/optical/frameProtocol';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Medium: 'medium' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/utils/file', () => ({ detectBarcodes: jest.fn() }));
jest.mock('@/utils/snackbarService', () => ({ showSnackbar: jest.fn() }));

const BLOCK_LEN = 8;

const frame = (overrides: Partial<FrameHeader> = {}): { data: string } => {
  const header: FrameHeader = {
    blockLen: BLOCK_LEN,
    k: 4,
    payloadFnv: 0x1234_5678,
    seq: 0,
    sessionId: 0xabcd,
    totalLen: 32,
    ...overrides,
  };
  return { data: base44Encode(packFrame(header, new Uint8Array(BLOCK_LEN).fill(3))) };
};

function setup() {
  const onBarcodeScanned = jest.fn();
  const onClose = jest.fn();
  const hook = renderHook(() => useBarcodeScanner({ onBarcodeScanned, onClose, visible: true }));
  return { hook, onBarcodeScanned, onClose };
}

describe('useBarcodeScanner optical stream detection', () => {
  it('offers the optical reader instead of looking the frame up as a product', () => {
    const { hook, onBarcodeScanned, onClose } = setup();

    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 1 })));
    // Suppressed from the very first frame. Letting it through would fire the product lookup and
    // tear the camera down for a "food not found" sheet, so the second frame — the one that
    // confirms the stream — would never arrive.
    expect(onBarcodeScanned).not.toHaveBeenCalled();
    expect(hook.result.current.isOpticalStreamDetected).toBe(false);

    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 2 })));
    expect(hook.result.current.isOpticalStreamDetected).toBe(true);
    expect(onBarcodeScanned).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The search latch must stay open: a swallowed frame is not an in-flight lookup, and leaving
    // it set would freeze the camera behind a spinner that nothing ever clears.
    expect(hook.result.current.isSearchingBarcodeRef.current).toBe(false);
  });

  it('keeps swallowing frames once dismissed, without re-offering', () => {
    const { hook, onBarcodeScanned } = setup();

    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 1 })));
    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 2 })));
    act(() => hook.result.current.dismissOpticalStreamHint());
    expect(hook.result.current.isOpticalStreamDetected).toBe(false);

    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 3 })));
    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 4 })));

    expect(hook.result.current.isOpticalStreamDetected).toBe(false);
    expect(onBarcodeScanned).not.toHaveBeenCalled();
  });

  it('still scans an ordinary barcode', () => {
    const { hook, onBarcodeScanned, onClose } = setup();

    act(() => hook.result.current.handleLiveBarcodeScanned({ data: '5901234123457' }));

    expect(onBarcodeScanned).toHaveBeenCalledWith('5901234123457');
    expect(onClose).toHaveBeenCalled();
    expect(hook.result.current.isOpticalStreamDetected).toBe(false);
  });

  it('resets the offer when the camera closes', () => {
    const onClose = jest.fn();
    const hook = renderHook(({ visible }) => useBarcodeScanner({ onClose, visible }), {
      initialProps: { visible: true },
    });

    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 1 })));
    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 2 })));
    expect(hook.result.current.isOpticalStreamDetected).toBe(true);

    hook.rerender({ visible: false });
    expect(hook.result.current.isOpticalStreamDetected).toBe(false);

    // A fresh open re-offers: the probe's dismissal memory must not survive the camera.
    hook.rerender({ visible: true });
    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 3 })));
    act(() => hook.result.current.handleLiveBarcodeScanned(frame({ seq: 4 })));
    expect(hook.result.current.isOpticalStreamDetected).toBe(true);
  });
});
