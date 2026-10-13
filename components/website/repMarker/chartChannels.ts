import { BRAND_GREEN_BRIGHT, HEADING_TEXT, hue } from '@/components/website/websiteColors';
import type { ChannelKey } from '@/utils/repMarkerData';

export const ACCENT_YELLOW = hue('amber');
export const ACCENT_RED = hue('error');

// Two complementary views of the same recording, because doubly-integrated
// position drifts so far it buries the reps (see the chart panels below):
//   • Orientation — the device's own drift-corrected Euler angle. Clearest for
//     rotational lifts (curls, extensions, presses where the wrist rotates).
//   • Acceleration — raw accel per axis + magnitude. Drift-free and works for
//     any lift. Dead-reckoned position is kept here but hidden by default.
export const CHART_COLORS: Record<ChannelKey, string> = {
  accelMag: HEADING_TEXT,
  accelX: hue('warning'),
  accelY: hue('amber'),
  accelZ: BRAND_GREEN_BRIGHT,
  angleX: hue('warning'),
  angleY: hue('amber'),
  angleZ: BRAND_GREEN_BRIGHT,
  // Position uses a separate palette so it stays distinct from accel in chart B.
  px: hue('info'),
  py: hue('purple'),
  pz: hue('pink'),
};

export const CHART_LABELS: Record<ChannelKey, string> = {
  accelMag: 'accel |a|',
  accelX: 'accel.x',
  accelY: 'accel.y',
  accelZ: 'accel.z',
  angleX: 'angle.x',
  angleY: 'angle.y',
  angleZ: 'angle.z',
  px: 'pos.x',
  py: 'pos.y',
  pz: 'pos.z',
};

// Chart A — orientation (degrees). |accel| (g) is offered but hidden by default
// since it shares the Y axis with degrees and would render as a near-flat line.
export const ORIENTATION_CHANNELS: ChannelKey[] = ['angleX', 'angleY', 'angleZ', 'accelMag'];
export const ORIENTATION_DEFAULT: ChannelKey[] = ['angleX', 'angleY', 'angleZ'];

// Chart B — acceleration (g). Position (metres) is kept for reference but hidden:
// over a long set its integration drift dwarfs everything else.
export const ACCEL_CHANNELS: ChannelKey[] = [
  'accelX',
  'accelY',
  'accelZ',
  'accelMag',
  'px',
  'py',
  'pz',
];
export const ACCEL_DEFAULT: ChannelKey[] = ['accelX', 'accelY', 'accelZ', 'accelMag'];
