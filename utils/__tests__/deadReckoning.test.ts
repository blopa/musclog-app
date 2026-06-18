import { computePosition, type DeadReckoningSample } from '@/utils/deadReckoning';

const SAMPLE_MS = 10; // 100 Hz

// Tiny deterministic sensor jitter. Real IMU data always carries noise; perfectly
// clean synthetic input (e.g. accel exactly [0,0,1]) hits the Madgwick gradient's
// zero fixed point and produces NaN, which never happens with real recordings.
const aJitter = (i: number, axis: number) => 0.0015 * Math.sin(i * 0.7 + axis * 2.1);
const gJitter = (i: number, axis: number) => 0.05 * Math.sin(i * 0.9 + axis * 1.3);

/** A still, level sensor: gravity on +Z, no rotation (with realistic jitter). */
function buildStationaryLevel(n: number): DeadReckoningSample[] {
  return Array.from({ length: n }, (_, i) => ({
    accel: { x: aJitter(i, 0), y: aJitter(i, 1), z: 1 + aJitter(i, 2) },
    gyro: { x: gJitter(i, 0), y: gJitter(i, 1), z: gJitter(i, 2) },
    timestamp: i * SAMPLE_MS,
  }));
}

/** A still sensor tilted 90° so gravity reads on the sensor's +X axis. */
function buildStationaryTilted(n: number): DeadReckoningSample[] {
  return Array.from({ length: n }, (_, i) => ({
    accel: { x: 1 + aJitter(i, 0), y: aJitter(i, 1), z: aJitter(i, 2) },
    gyro: { x: gJitter(i, 0), y: gJitter(i, 1), z: gJitter(i, 2) },
    timestamp: i * SAMPLE_MS,
  }));
}

/** Rest → vertical acceleration bump (changes |accel| → non-stationary) → rest. */
function buildMotion(): DeadReckoningSample[] {
  return Array.from({ length: 120 }, (_, i) => {
    if (i < 30 || i >= 90) {
      return {
        accel: { x: aJitter(i, 0), y: aJitter(i, 1), z: 1 + aJitter(i, 2) },
        gyro: { x: gJitter(i, 0), y: gJitter(i, 1), z: gJitter(i, 2) },
        timestamp: i * SAMPLE_MS,
      };
    }
    const phase = ((i - 30) / 60) * Math.PI * 2;
    return {
      accel: { x: aJitter(i, 0), y: aJitter(i, 1), z: 1 + 0.5 * Math.sin(phase) + aJitter(i, 2) },
      gyro: { x: gJitter(i, 0), y: gJitter(i, 1), z: gJitter(i, 2) },
      timestamp: i * SAMPLE_MS,
    };
  });
}

const allFinite = (arr: number[]) => arr.every((v) => Number.isFinite(v));
const maxAbs = (arr: number[]) => Math.max(...arr.map(Math.abs));

describe('computePosition', () => {
  describe('output contract', () => {
    it('returns arrays aligned with the input length', () => {
      const r = computePosition(buildStationaryLevel(100));
      expect(r.timestampsMs).toHaveLength(100);
      expect(r.px).toHaveLength(100);
      expect(r.py).toHaveLength(100);
      expect(r.pz).toHaveLength(100);
      expect(r.accelMagG).toHaveLength(100);
      expect(r.stationary).toHaveLength(100);
    });

    it('derives the sample rate from the timestamps', () => {
      // 99 intervals across 0.99 s → 100 Hz
      expect(computePosition(buildStationaryLevel(100)).srHz).toBeCloseTo(100, 5);
    });

    it('reports accelerometer magnitude in g', () => {
      const samples: DeadReckoningSample[] = [
        { accel: { x: 3, y: 4, z: 0 }, gyro: { x: 0, y: 0, z: 0 }, timestamp: 0 },
        { accel: { x: 0, y: 0, z: 2 }, gyro: { x: 0, y: 0, z: 0 }, timestamp: SAMPLE_MS },
      ];
      const r = computePosition(samples);
      expect(r.accelMagG[0]).toBeCloseTo(5, 10);
      expect(r.accelMagG[1]).toBeCloseTo(2, 10);
    });
  });

  describe('edge cases', () => {
    it('handles an empty recording', () => {
      const r = computePosition([]);
      expect(r.timestampsMs).toHaveLength(0);
      expect(r.px).toHaveLength(0);
      expect(r.srHz).toBe(0);
    });

    it('handles a single sample', () => {
      const r = computePosition([
        { accel: { x: 0, y: 0, z: 1 }, gyro: { x: 0, y: 0, z: 0 }, timestamp: 0 },
      ]);
      expect(r.timestampsMs).toEqual([0]);
      expect(r.px).toEqual([0]);
      expect(r.py).toEqual([0]);
      expect(r.pz).toEqual([0]);
      expect(r.accelMagG[0]).toBeCloseTo(1, 10);
      expect(r.srHz).toBe(0);
    });

    it('handles two samples without producing NaN', () => {
      const r = computePosition(buildStationaryLevel(2));
      expect(allFinite(r.px) && allFinite(r.py) && allFinite(r.pz)).toBe(true);
    });
  });

  describe('input ordering', () => {
    it('sorts samples by timestamp before integrating', () => {
      const shuffled = [...buildStationaryLevel(20)].reverse();
      const r = computePosition(shuffled);
      const sortedTs = [...r.timestampsMs].sort((a, b) => a - b);
      expect(r.timestampsMs).toEqual(sortedTs);
    });
  });

  describe('zero-velocity (ZUPT) detection', () => {
    it('flags a perfectly still recording as stationary', () => {
      expect(computePosition(buildStationaryLevel(100)).stationary.every(Boolean)).toBe(true);
    });

    it('does not drift while stationary (velocity is zeroed)', () => {
      const r = computePosition(buildStationaryLevel(100));
      for (const v of [...r.px, ...r.py, ...r.pz]) {
        expect(v).toBeCloseTo(0, 8);
      }
    });

    it('distinguishes rest from a motion burst', () => {
      const r = computePosition(buildMotion());
      expect(r.stationary[10]).toBe(true); // initial rest
      expect(r.stationary[60]).toBe(false); // acceleration bump
      expect(r.stationary[110]).toBe(true); // final rest
    });
  });

  describe('gravity removal via orientation', () => {
    it('removes gravity regardless of sensor tilt, without NaN or drift', () => {
      const r = computePosition(buildStationaryTilted(100));
      expect(r.accelMagG[0]).toBeCloseTo(1, 3);
      expect(allFinite(r.px) && allFinite(r.py) && allFinite(r.pz)).toBe(true);
      // A still (if tilted) sensor must not accumulate displacement.
      for (const v of [...r.px, ...r.py, ...r.pz]) {
        expect(v).toBeCloseTo(0, 6);
      }
    });
  });

  describe('motion integration', () => {
    it('produces finite, non-zero displacement during motion', () => {
      const r = computePosition(buildMotion());
      const disp = Math.max(maxAbs(r.px), maxAbs(r.py), maxAbs(r.pz));
      expect(Number.isFinite(disp)).toBe(true);
      expect(disp).toBeGreaterThan(0);
      expect(allFinite(r.px) && allFinite(r.py) && allFinite(r.pz)).toBe(true);
    });
  });
});
