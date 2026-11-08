import { useEffect, useRef, useState } from 'react';

import { database } from '@/database/database-instance';
import { handleError } from '@/utils/handleError';

type TableQueryOptions<T> = {
  /** The tables whose changes read the data again. */
  tables: readonly string[];
  /** Reads the data. Called again after every change to `tables`. */
  load: () => Promise<T>;
  /** What is shown before the first read finishes, and after a read fails. */
  empty: T;
  /** Names the caller in the error report. */
  scope: string;
  /** What the read depends on besides the tables; a new key reads again. */
  key?: string;
  /** Off, nothing is read or watched and `empty` is returned. */
  enabled?: boolean;
  /** Wait this long after a change before reading, so a burst of writes reads once. */
  debounceMs?: number;
};

/**
 * Data that is read from the database and read again whenever one of its tables changes, for
 * results that are computed from several tables (so a single record observer does not fit). Only
 * the newest read may publish, so a slow earlier read can never overwrite a later one, and a failed
 * read shows `empty` instead of throwing into render. `isLoading` is true until the first read
 * has finished.
 *
 * Every read is deferred to a timer, so the effect body itself never sets state.
 */
export function useTableQuery<T>({
  tables,
  load,
  empty,
  scope,
  key = '',
  enabled = true,
  debounceMs = 0,
}: TableQueryOptions<T>): { data: T; isLoading: boolean } {
  const [data, setData] = useState<T>(empty);
  const [isLoading, setIsLoading] = useState(true);
  const latest = useRef({ load, empty, scope });
  const requestRef = useRef(0);
  const tablesKey = tables.join('|');

  useEffect(() => {
    latest.current = { load, empty, scope };
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const read = async () => {
      const request = ++requestRef.current;
      const isNewest = () => !cancelled && request === requestRef.current;

      try {
        const next = await latest.current.load();
        if (isNewest()) {
          setData(next);
        }
      } catch (error) {
        void handleError(error, latest.current.scope, { showSnackbar: false });
        if (isNewest()) {
          setData(latest.current.empty);
        }
      } finally {
        if (isNewest()) {
          setIsLoading(false);
        }
      }
    };

    const schedule = (delayMs: number) => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = undefined;
        void read();
      }, delayMs);
    };

    schedule(0);
    const subscription = database
      .withChangesForTables(tablesKey.split('|'))
      .subscribe(() => schedule(debounceMs));

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }

      subscription.unsubscribe();
    };
  }, [enabled, key, tablesKey, debounceMs]);

  // While off, what an earlier query read is not shown; turning it on again reads afresh.
  if (!enabled) {
    return { data: empty, isLoading: false };
  }

  return { data, isLoading };
}
