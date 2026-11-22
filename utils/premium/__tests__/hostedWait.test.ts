import {
  HOSTED_SLOW_MS,
  hostedWaitLine,
  isHostedBackingOff,
  whileHostedBackingOff,
} from '@/utils/premium/hostedWait';

describe('hostedWaitLine', () => {
  it('stays quiet for a normal wait and says "working" once it is slow', () => {
    expect(hostedWaitLine(0, false)).toBeNull();
    expect(hostedWaitLine(HOSTED_SLOW_MS - 1, false)).toBeNull();
    expect(hostedWaitLine(HOSTED_SLOW_MS, false)).toBe('working');
  });

  it('says "busy" at once while a retry is backing off', () => {
    expect(hostedWaitLine(0, true)).toBe('busy');
  });
});

describe('whileHostedBackingOff', () => {
  it('is on only during the wait, nests, and clears when the wait throws', async () => {
    expect(isHostedBackingOff()).toBe(false);

    let during = false;
    await whileHostedBackingOff(async () => {
      await whileHostedBackingOff(async () => undefined);
      during = isHostedBackingOff();
    });
    expect(during).toBe(true);
    expect(isHostedBackingOff()).toBe(false);

    await expect(
      whileHostedBackingOff(async () => {
        throw new Error('x');
      })
    ).rejects.toThrow('x');
    expect(isHostedBackingOff()).toBe(false);
  });
});
