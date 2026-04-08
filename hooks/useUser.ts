import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import User from '@/database/models/User';

export interface UseUserResult {
  user: User | null;
  isLoading: boolean;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const query = database
      .get<User>('users')
      .query(Q.where('deleted_at', Q.eq(null)))
      .extend(Q.take(1));

    const subscription = query.observe().subscribe({
      next: (users) => {
        setUser(users[0] || null);
        setIsLoading(false);
      },
      error: () => {
        setUser(null);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      user,
      isLoading,
    }),
    [user, isLoading]
  );
}
