import { coachStatusBadge } from '@/components/coach/coachStatusBadge';
import { AI_PROVIDER_KINDS } from '@/constants/ai';

describe('coachStatusBadge', () => {
  const networkProviders = AI_PROVIDER_KINDS.filter((provider) => provider !== 'on-device');

  it.each(networkProviders)('names %s while connected', (provider) => {
    const badge = coachStatusBadge(provider, true);
    expect(badge.tone).toBe('online');
    expect(badge.labelKey).toMatch(/^aiOnboarding\.provider\.names\./);
  });

  it('names the exact provider in use', () => {
    expect(coachStatusBadge('gemini', true).labelKey).toBe('aiOnboarding.provider.names.gemini');
    expect(coachStatusBadge('claude', true).labelKey).toBe('aiOnboarding.provider.names.claude');
    expect(coachStatusBadge('local', true).labelKey).toBe('aiOnboarding.provider.names.local');
  });

  it.each(networkProviders)('reads Offline for %s without a connection', (provider) => {
    expect(coachStatusBadge(provider, false)).toEqual({
      tone: 'offline',
      labelKey: 'coach.statusOffline',
    });
  });

  it.each([true, false])('shows On-Device AI whatever the connection (%s)', (isConnected) => {
    expect(coachStatusBadge('on-device', isConnected)).toEqual({
      tone: 'onDevice',
      labelKey: 'coach.statusOnDevice',
    });
  });

  it('falls back to Online/Offline when no provider is set', () => {
    expect(coachStatusBadge(null, true)).toEqual({ tone: 'online', labelKey: 'coach.status' });
    expect(coachStatusBadge(null, false).tone).toBe('offline');
  });
});
