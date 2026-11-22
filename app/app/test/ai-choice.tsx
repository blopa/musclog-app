import MusclogApiScreen from '@/app/app/onboarding/musclog-api';
import { AiChoiceFixtureContext } from '@/components/onboarding/aiChoiceFixture';
import { PREMIUM_FIXTURE_STATES } from '@/components/premium/premiumFixtureStates';
import { PremiumFixtureContext } from '@/hooks/usePremium';

/**
 * The real onboarding AI step with Premium on (store price, not subscribed) and the free tier
 * offered, so the app-store capture can show all three cards. Reachable only in a screenshot build
 * (`app/app/test/_layout.tsx`); nothing in the app links here.
 */
export default function AiChoiceFixtureScreen() {
  const notSubscribed = PREMIUM_FIXTURE_STATES.find((state) => state.id === 'not-subscribed');

  return (
    <PremiumFixtureContext.Provider value={notSubscribed?.build() ?? null}>
      <AiChoiceFixtureContext.Provider value={{ freeTierAvailable: true }}>
        <MusclogApiScreen />
      </AiChoiceFixtureContext.Provider>
    </PremiumFixtureContext.Provider>
  );
}
