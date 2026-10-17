import { createWidgetRefreshQueue } from '../widgetRefreshQueue';

it('coalesces changes while reading and publishes only the newest data', async () => {
  let resolve!: (value: number) => void;
  const read = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue(2);
  const publish = jest.fn();
  const queue = createWidgetRefreshQueue(read, publish, jest.fn());
  const pending = queue.refresh();
  await queue.refresh();
  await queue.refresh();
  resolve(1);
  await pending;
  expect(read).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls).toEqual([[2]]);
});

it('discards an in-flight result after reset or unmount', async () => {
  let resolve!: (value: number) => void;
  const read = jest.fn(
    () =>
      new Promise<number>((done) => {
        resolve = done;
      })
  );
  const publish = jest.fn();
  const queue = createWidgetRefreshQueue(read, publish, jest.fn());
  const pending = queue.refresh();
  queue.dispose();
  resolve(1);
  await pending;
  await queue.refresh();
  expect(publish).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(1);
});

it('reports a failed refresh and permits a later retry', async () => {
  const error = new Error('database temporarily unavailable');
  const read = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(2);
  const publish = jest.fn();
  const report = jest.fn();
  const queue = createWidgetRefreshQueue(read, publish, report);
  await expect(queue.refresh()).resolves.toBeUndefined();
  await queue.refresh();
  expect(report).toHaveBeenCalledWith(error);
  expect(publish).toHaveBeenCalledWith(2);
});
