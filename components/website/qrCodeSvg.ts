import ErrorCorrectionLevel from '@zxing/library/cjs/core/qrcode/decoder/ErrorCorrectionLevel';
import QRCodeEncoder from '@zxing/library/cjs/core/qrcode/encoder/Encoder';

export type QrCodeSvgData = {
  /** Width and height of the module grid; the SVG `viewBox` is `0 0 size size`. */
  size: number;
  /** One `<path d>` covering every dark module, so the whole code is a single element. */
  path: string;
};

/**
 * Encodes `text` as a QR code and returns it as SVG path data.
 *
 * Pure and DOM-free on purpose: `app/+html.tsx` runs only in Node during static export,
 * where `BrowserQRCodeSvgWriter` (used by the interactive popover in `StoreButtons.web.tsx`)
 * is unavailable because it needs `document`.
 */
export function qrCodeSvgData(text: string): QrCodeSvgData {
  const matrix = QRCodeEncoder.encode(text, ErrorCorrectionLevel.L).getMatrix();
  const size = matrix.getWidth();
  const modules: string[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix.get(x, y)) {
        modules.push(`M${x},${y}h1v1h-1z`);
      }
    }
  }

  return { size, path: modules.join('') };
}
