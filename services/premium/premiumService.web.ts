// Web has no Premium: every call reports it, nothing touches storage or the network.
import type {
  HostedConfig,
  PremiumResult,
  PremiumStatus,
  SessionGrant,
  UsageSnapshot,
} from '@/utils/premium/premiumState';

const unavailable = <T>(): Promise<PremiumResult<T>> =>
  Promise.resolve({ ok: false, failure: 'not_available' });

export function hostedAiBaseUrl(): string | null {
  return null;
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  return 'not_enrolled';
}

export const enrollThisDevice = () => unavailable<SessionGrant>();
export const purchaseAndEnroll = () => unavailable<SessionGrant>();
export const restoreAndEnroll = () => unavailable<SessionGrant>();
export const getSessionGrant = () => unavailable<SessionGrant>();
export const refreshPremiumUsage = () => unavailable<UsageSnapshot>();
export const fetchPremiumConfig = () => unavailable<HostedConfig>();

export async function resetPremium(): Promise<{ rcId: string; revenueCatSwitched: boolean }> {
  throw new Error('Premium identity is not available on web');
}

export function resetPremiumConfigCache(): void {}
