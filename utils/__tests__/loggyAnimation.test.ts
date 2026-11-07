import {
  type LoggyLayerAnimation,
  type LoggyMatrix,
  loggyMatrixToTransform,
  sampleLoggyLayer,
} from '../loggyAnimation';

const IDENTITY: LoggyMatrix = [1, 0, 0, 1, 0, 0];

function layer(overrides: Partial<LoggyLayerAnimation>): LoggyLayerAnimation {
  return {
    origin: [0, 0],
    durationMs: 1000,
    easing: 'linear',
    fns: ['translate'],
    frames: [
      { at: 0, args: [[0, 0]] },
      { at: 1, args: [[10, 0]] },
    ],
    animatesOpacity: false,
    ...overrides,
  };
}

function apply(matrix: LoggyMatrix, x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

describe('sampleLoggyLayer', () => {
  it('interpolates between keyframes', () => {
    expect(sampleLoggyLayer(layer({}), 250).matrix[4]).toBeCloseTo(2.5);
    expect(sampleLoggyLayer(layer({}), 500).matrix[4]).toBeCloseTo(5);
  });

  it('repeats every duration, and handles a clock that has run past it', () => {
    const still = layer({});

    expect(sampleLoggyLayer(still, 1250).matrix[4]).toBeCloseTo(2.5);
    expect(sampleLoggyLayer(still, 7000).matrix).toEqual(IDENTITY);
  });

  it('applies CSS ease-in-out per keyframe interval', () => {
    const eased = layer({ easing: 'ease-in-out' });

    // Symmetric curve: the midpoint is the midpoint, the quarter point lags behind linear.
    expect(sampleLoggyLayer(eased, 500).matrix[4]).toBeCloseTo(5, 3);
    expect(sampleLoggyLayer(eased, 250).matrix[4]).toBeLessThan(2.5);
    expect(sampleLoggyLayer(eased, 750).matrix[4]).toBeGreaterThan(7.5);
  });

  it('eases each interval on its own, not the loop as a whole', () => {
    const twoSteps = layer({
      easing: 'ease-in-out',
      frames: [
        { at: 0, args: [[0, 0]] },
        { at: 0.5, args: [[10, 0]] },
        { at: 1, args: [[0, 0]] },
      ],
    });

    expect(sampleLoggyLayer(twoSteps, 250).matrix[4]).toBeCloseTo(5, 3);
    expect(sampleLoggyLayer(twoSteps, 500).matrix[4]).toBeCloseTo(10, 3);
    expect(sampleLoggyLayer(twoSteps, 750).matrix[4]).toBeCloseTo(5, 3);
  });

  it('holds across equal keyframes', () => {
    const held = layer({
      frames: [
        { at: 0, args: [[0, 0]] },
        { at: 0.4, args: [[0, 0]] },
        { at: 0.6, args: [[0, 0]] },
        { at: 1, args: [[0, 0]] },
      ],
    });

    expect(sampleLoggyLayer(held, 500).matrix).toEqual(IDENTITY);
  });

  it('rotates about the transform origin, which stays put', () => {
    const turning = layer({
      origin: [100, 50],
      fns: ['rotate'],
      frames: [
        { at: 0, args: [[0]] },
        { at: 1, args: [[90]] },
      ],
    });
    const { matrix } = sampleLoggyLayer(turning, 1000 - 1e-6);

    expect(apply(matrix, 100, 50)[0]).toBeCloseTo(100, 3);
    expect(apply(matrix, 100, 50)[1]).toBeCloseTo(50, 3);

    // A point 10 to the right of the pivot ends up 10 below it (SVG's y axis points down).
    const [x, y] = apply(matrix, 110, 50);

    expect(x).toBeCloseTo(100, 2);
    expect(y).toBeCloseTo(60, 2);
  });

  it('scales about the origin, so a squash does not move the pivot', () => {
    const squash = layer({
      origin: [30, 40],
      fns: ['scale'],
      frames: [
        { at: 0, args: [[1, 1]] },
        { at: 1, args: [[1, 0.5]] },
      ],
    });
    const { matrix } = sampleLoggyLayer(squash, 1000 - 1e-6);

    expect(apply(matrix, 30, 40)[1]).toBeCloseTo(40, 3);
    expect(apply(matrix, 30, 80)[1]).toBeCloseTo(60, 2);
  });

  it('composes the functions in the order written, as CSS does', () => {
    const frames = (a: number[], b: number[]) => [
      { at: 0, args: [[0, 0], [0]] },
      { at: 1, args: [a, b] },
    ];
    const translateThenRotate = sampleLoggyLayer(
      layer({ fns: ['translate', 'rotate'], frames: frames([10, 0], [90]) }),
      1000 - 1e-6
    );
    const rotateThenTranslate = sampleLoggyLayer(
      layer({
        fns: ['rotate', 'translate'],
        frames: [
          { at: 0, args: [[0], [0, 0]] },
          { at: 1, args: [[90], [10, 0]] },
        ],
      }),
      1000 - 1e-6
    );

    // `translate(10) rotate(90)` moves the origin to x = 10 first; the reverse swings the shift.
    expect(apply(translateThenRotate.matrix, 0, 0)[0]).toBeCloseTo(10, 2);
    expect(apply(translateThenRotate.matrix, 0, 0)[1]).toBeCloseTo(0, 2);
    expect(apply(rotateThenTranslate.matrix, 0, 0)[0]).toBeCloseTo(0, 2);
    expect(apply(rotateThenTranslate.matrix, 0, 0)[1]).toBeCloseTo(10, 2);
  });

  it('skews along x', () => {
    const lean = layer({
      fns: ['skewX'],
      frames: [
        { at: 0, args: [[0]] },
        { at: 1, args: [[45]] },
      ],
    });
    const [x] = apply(sampleLoggyLayer(lean, 1000 - 1e-6).matrix, 0, 10);

    expect(x).toBeCloseTo(10, 2);
  });

  it('interpolates opacity only when the keyframes carry it', () => {
    const fading = layer({
      animatesOpacity: true,
      frames: [
        { at: 0, args: [[0, 0]], opacity: 1 },
        { at: 1, args: [[0, 0]], opacity: 0.2 },
      ],
    });

    expect(sampleLoggyLayer(fading, 500).opacity).toBeCloseTo(0.6);
    expect(sampleLoggyLayer(layer({}), 500).opacity).toBe(1);
  });
});

describe('loggyMatrixToTransform', () => {
  it('writes the SVG transform attribute', () => {
    expect(loggyMatrixToTransform([1, 0, 0, 1, 3, -4])).toBe('matrix(1 0 0 1 3 -4)');
  });
});
