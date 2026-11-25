/**
 * Runs async operations one at a time, in the order they were queued. A failed operation rejects
 * only its own caller, because the next turn waits for the tail, which never rejects.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const turn = tail.then(operation, operation);
      tail = turn.then(
        () => undefined,
        () => undefined
      );

      return turn;
    },
    reset() {
      tail = Promise.resolve();
    },
  };
}
