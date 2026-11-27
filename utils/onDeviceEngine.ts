/**
 * The two ways Musclog runs AI on the phone, and what each can do. Pure.
 *
 * `apple` is the system model (Apple Intelligence, text only). `gguf` is the downloaded model run
 * by llama.rn (text and photos once its projector is installed). Both are the single provider kind
 * `on-device`; the difference is this capability object, never a branch in a caller.
 *
 * The stored choice is `auto` until the person picks: iOS means Apple (what every existing
 * Apple Intelligence user already has), everywhere else the downloaded model.
 */

export const ON_DEVICE_ENGINE_CHOICES = ['auto', 'apple', 'gguf'] as const;

export type OnDeviceEngineChoice = (typeof ON_DEVICE_ENGINE_CHOICES)[number];

export type OnDeviceEngine = 'apple' | 'gguf';

export function parseOnDeviceEngineChoice(raw: string): OnDeviceEngineChoice {
  return (ON_DEVICE_ENGINE_CHOICES as readonly string[]).includes(raw)
    ? (raw as OnDeviceEngineChoice)
    : 'auto';
}

/** Apple's model exists on iOS only, so an `apple` choice on another platform runs `gguf`. */
export function resolveOnDeviceEngine(
  choice: OnDeviceEngineChoice,
  platform: string
): OnDeviceEngine {
  if (choice === 'gguf') {
    return 'gguf';
  }

  return platform === 'ios' ? 'apple' : 'gguf';
}

/** Characters of context each engine is given (`ProviderPolicy.contextChars`). */
export const ON_DEVICE_CONTEXT_CHARS: Record<OnDeviceEngine, number> = {
  // Apple's system model has a small window; the tight cap is its optimisation spec.
  apple: 4500,
  // The downloaded model opens 4096 tokens; about the same budget as a local server.
  gguf: 8000,
};

export type OnDeviceCapabilities = {
  engine: OnDeviceEngine;
  /** Can read a food photo: the downloaded model with its projector installed. */
  vision: boolean;
  /** The downloaded model's optional text model is installed: requests without a photo go to it. */
  textModel: boolean;
  contextChars: number;
};

export function onDeviceCapabilities(
  engine: OnDeviceEngine,
  projectorInstalled: boolean,
  textModelInstalled: boolean = false
): OnDeviceCapabilities {
  return {
    engine,
    vision: engine === 'gguf' && projectorInstalled,
    textModel: engine === 'gguf' && textModelInstalled,
    contextChars: ON_DEVICE_CONTEXT_CHARS[engine],
  };
}
