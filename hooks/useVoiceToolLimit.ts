import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { providerPolicyFor } from '@/utils/providerPolicy';

export type VoiceToolLimit = {
  /** How many voice tools are offered at a time; undefined when the AI in use takes them all. */
  max: number | undefined;
  /** The downloaded model, which is never offered a tool it was measured to route badly. */
  nativeModel: boolean;
};

/**
 * What the AI in use can be offered of the voice tools. It comes from the provider's policy, so a
 * small model answers fewer tools than a large one.
 */
export function useVoiceToolLimit(): VoiceToolLimit {
  const { aiProvider } = useSettings();
  const { capabilities } = useOnDeviceStatus();

  if (!aiProvider) {
    return { max: undefined, nativeModel: false };
  }

  const { maxVoiceTools, nativeToolCalls } = providerPolicyFor({
    provider: aiProvider,
    engine: capabilities.engine,
    textModel: capabilities.textModel,
  });

  return { max: maxVoiceTools, nativeModel: Boolean(nativeToolCalls) };
}
