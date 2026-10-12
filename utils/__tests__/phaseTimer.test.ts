import { createPhaseTimer } from '../phaseTimer';

describe('createPhaseTimer', () => {
  it('attributes the time since the previous mark to each phase', () => {
    let clock = 1000;
    const timer = createPhaseTimer('Scan', () => clock);

    clock += 120;
    expect(timer.mark('image-read')).toBe(120);
    clock += 30;
    timer.mark('settings-read');
    clock += 4000;
    timer.mark('request');

    expect(timer.phases()).toEqual([
      { phase: 'image-read', ms: 120 },
      { phase: 'settings-read', ms: 30 },
      { phase: 'request', ms: 4000 },
    ]);
  });

  it('logs one line with every phase, the total and the outcome', () => {
    let clock = 0;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const timer = createPhaseTimer('Scan', () => clock);
    clock = 50;
    timer.mark('a');
    clock = 80;

    expect(timer.log('ok')).toBe('[Scan] a=50ms total=80ms outcome=ok');
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
