export const WIT_SERVICE_UUID = '0000ffe5-0000-1000-8000-00805f9a34fb';
export const WIT_NOTIFY_UUID = '0000ffe4-0000-1000-8000-00805f9a34fb';
export const WIT_WRITE_UUID = '0000ffe9-0000-1000-8000-00805f9a34fb';

export const WIT_DEVICE_PREFIX = 'WT';
export const WIT_DEFAULT_SCAN_TIMEOUT_MS = 10_000;
export const WIT_DEFAULT_POLL_INTERVAL_MS = 500;

export const WIT_OUTPUT_RATE_CODES = {
  1: 3,
  5: 5,
  10: 6,
  50: 8,
  100: 9,
  200: 11,
} as const;

export const WIT_BANDWIDTH_CODES = {
  5: 7,
  10: 6,
  20: 5,
  42: 4,
  98: 3,
  188: 2,
} as const;
