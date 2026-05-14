import type { Gender } from '@/database/models/User';

const DEFAULT_USERNAMES_BY_GENDER: Record<Gender, string[]> = {
  male: ['StrongLifter', 'PowerBuilder', 'IronAthlete'],
  female: ['StrongLifter', 'PowerBuilder', 'IronAthlete'],
  other: ['StrongLifter', 'PowerBuilder', 'IronAthlete'],
};

/**
 * Generates a default username based on gender with a random 4-digit suffix.
 */
export function getDefaultUsernameForGender(gender: Gender): string {
  const usernames = DEFAULT_USERNAMES_BY_GENDER[gender] ?? DEFAULT_USERNAMES_BY_GENDER.other;
  const username = usernames[Math.floor(Math.random() * usernames.length)];
  const suffix = Math.floor(1000 + Math.random() * 9000);

  return `${username}${suffix}`;
}
