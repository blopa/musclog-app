/**
 * The subscribe/notify pair every small in-memory store needs (`useSyncExternalStore` takes
 * `subscribe` as is). Pure and import-free, so `utils/premium/` may import it relatively.
 */
export function createListeners(): { subscribe(listener: () => void): () => void; notify(): void } {
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
  };
}
