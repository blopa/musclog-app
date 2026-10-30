/** Serializes refreshes, discarding results invalidated by newer data or disposal. */
export function createWidgetRefreshQueue<T>(
  read: () => Promise<T>,
  publish: (value: T) => void,
  report: (error: unknown) => void
) {
  let revision = 0;
  let running = false;
  let disposed = false;

  const refresh = async () => {
    revision += 1;
    if (running || disposed) {
      return;
    }

    running = true;
    try {
      while (!disposed) {
        const current = revision;
        try {
          const value = await read();
          if (!disposed && current === revision) {
            publish(value);
          }
        } catch (error) {
          report(error);
        }

        if (current === revision) {
          break;
        }
      }
    } finally {
      running = false;
    }
  };

  return {
    refresh,
    dispose: () => {
      disposed = true;
      revision += 1;
    },
  };
}
