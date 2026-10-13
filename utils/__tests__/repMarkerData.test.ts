import { buildChartData, fmtMs } from '../repMarkerData';

describe('fmtMs', () => {
  it('formats relative milliseconds as m:ss.s with a sign', () => {
    expect(fmtMs(0)).toBe('0:00.0');
    expect(fmtMs(65_400)).toBe('1:05.4');
    expect(fmtMs(-1500)).toBe('-0:01.5');
  });
});

describe('buildChartData', () => {
  const sample = (timestamp: number, x: number) => ({
    timestamp,
    accel: { x, y: 0, z: 1 },
    angle: { x: 10, y: 20, z: 30 },
    gyro: { x: 0, y: 0, z: 0 },
  });

  it('anchors time to startedAt and keeps every series the same length', () => {
    const data = buildChartData({
      samples: [sample(1_100, 0.2), sample(1_000, 0.1), sample(1_200, 0.3)] as never,
      startedAt: new Date(1_000).toISOString(),
    });

    expect(data.startedAtMs).toBe(1_000);
    expect(data.timeMs).toEqual([0, 100, 200]);
    expect(data.series.accelX).toEqual([0.1, 0.2, 0.3]);
    expect(data.series.angleZ).toEqual([30, 30, 30]);
    for (const values of Object.values(data.series)) {
      expect(values).toHaveLength(data.timeMs.length);
    }
  });
});
