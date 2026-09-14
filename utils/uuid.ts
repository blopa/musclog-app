import { randomUUID } from 'expo-crypto';

/**
 * Generate a UUID v4 for use as sync identifiers
 * Uses expo-crypto for secure random UUID generation
 */
export function generateUUID(): string {
  return randomUUID();
}
