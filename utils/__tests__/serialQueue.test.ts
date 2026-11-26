import { createSerialQueue } from '@/utils/serialQueue';

describe('createSerialQueue', () => {
  it('runs operations one at a time, in queue order', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    let release: () => void = () => undefined;
    const first = queue.run(
      () =>
        new Promise<void>((resolve) => {
          events.push('first start');
          release = () => {
            events.push('first end');
            resolve();
          };
        })
    );
    const second = queue.run(async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first start']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['first start', 'first end', 'second']);
  });

  it('a rejected operation rejects only its caller and the next one still runs', async () => {
    const queue = createSerialQueue();
    const error = new Error('boom');

    const failing = queue.run(() => Promise.reject(error));
    const next = queue.run(async () => 'ok');

    await expect(failing).rejects.toBe(error);
    await expect(next).resolves.toBe('ok');
  });

  it('reset forgets the waiting tail so new work does not wait for old work', async () => {
    const queue = createSerialQueue();
    let finish: () => void = () => undefined;
    void queue.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );

    queue.reset();
    await expect(queue.run(async () => 'fresh')).resolves.toBe('fresh');
    finish();
  });
});
