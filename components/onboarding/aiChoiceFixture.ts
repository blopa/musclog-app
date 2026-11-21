import { createContext } from 'react';

/**
 * Test-fixture seam only: `/app/test/ai-choice` wraps the real onboarding AI step in a provider so
 * the app-store capture can show all three cards on web, where the free tier is hidden in a
 * production build. The default is null, so nothing in the app ever sets it.
 */
export const AiChoiceFixtureContext = createContext<{ freeTierAvailable: boolean } | null>(null);
