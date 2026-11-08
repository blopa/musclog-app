import { AppState, type AppStateStatus } from 'react-native';

type Timer = {
  callback: () => void;
  dueAt: number;
  handle?: ReturnType<typeof setTimeout>;
};

/** A clock and timer queue whose time advances only while the app is active. */
export class BootForegroundClock {
  private elapsedMs = 0;
  private activeSince: number | null;
  private disposed = false;
  private nextTimerId = 0;
  private timers = new Map<number, Timer>();
  private pendingDelays = new Set<() => void>();
  private subscription: { remove?: () => void } | undefined;

  constructor() {
    this.activeSince = this.isActive(AppState.currentState) ? Date.now() : null;
    this.subscription = AppState.addEventListener?.('change', this.onAppStateChange);
  }

  elapsed(): number {
    return this.elapsedMs + (this.activeSince == null ? 0 : Date.now() - this.activeSince);
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = ++this.nextTimerId;
    this.timers.set(id, { callback, dueAt: this.elapsed() + Math.max(0, delayMs) });
    this.schedule(id);
    return id;
  }

  clearTimeout(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle != null) {
      clearTimeout(timer.handle);
    }

    this.timers.delete(id);
  }

  delay(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        this.pendingDelays.delete(finish);
        resolve();
      };

      this.pendingDelays.add(finish);
      this.setTimeout(finish, delayMs);
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.pauseClock();
    for (const timer of this.timers.values()) {
      if (timer.handle != null) {
        clearTimeout(timer.handle);
      }
    }

    this.timers.clear();
    for (const finishDelay of this.pendingDelays) {
      finishDelay();
    }

    this.subscription?.remove?.();
  }

  private isActive(state: string | null | undefined): boolean {
    // Before native AppState initializes, retain the historical foreground behavior.
    return state == null || state === 'active';
  }

  private onAppStateChange = (state: AppStateStatus): void => {
    if (this.disposed) {
      return;
    }

    const active = this.isActive(state);
    if (active && this.activeSince == null) {
      this.activeSince = Date.now();
      for (const id of this.timers.keys()) {
        this.schedule(id);
      }
    } else if (!active && this.activeSince != null) {
      this.pauseClock(true);
    }
  };

  private pauseClock(countActiveTime = true): void {
    if (this.activeSince != null) {
      if (countActiveTime) {
        this.elapsedMs += Date.now() - this.activeSince;
      }

      this.activeSince = null;
    }

    for (const timer of this.timers.values()) {
      if (timer.handle != null) {
        clearTimeout(timer.handle);
      }

      timer.handle = undefined;
    }
  }

  private schedule(id: number): void {
    const timer = this.timers.get(id);
    if (timer == null || timer.handle != null || this.activeSince == null || this.disposed) {
      return;
    }

    timer.handle = setTimeout(
      () => {
        timer.handle = undefined;
        // AppState may have changed before its event reached this listener.
        if (!this.isActive(AppState.currentState)) {
          // A suspended runtime cannot tell when it actually backgrounded.
          // Drop that unobserved interval instead of counting hours as active.
          this.pauseClock(false);
          return;
        }

        if (this.elapsed() < timer.dueAt) {
          this.schedule(id);
          return;
        }

        this.timers.delete(id);
        timer.callback();
      },
      Math.max(0, timer.dueAt - this.elapsed())
    );
  }
}
