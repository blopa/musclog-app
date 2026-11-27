import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { providerPolicyFor } from '@/utils/providerPolicy';

/**
 * How many voice tools the AI in use is offered, or undefined when it takes them all. The limit
 * comes from the provider's policy, so a small model answers fewer tools than a large one.
 */
export function useVoiceToolLimit(): number | undefined {
  const { aiProvider } = useSettings();
  const { capabilities } = useOnDeviceStatus();

  if (!aiProvider) {
    return undefined;
  }

  return providerPolicyFor({
    provider: aiProvider,
    engine: capabilities.engine,
    textModel: capabilities.textModel,
  }).maxVoiceTools;
}
