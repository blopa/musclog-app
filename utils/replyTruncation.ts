// Whether a provider cut a reply off at its token limit, read from the provider's own stop signal.
// Pure and relative-import-only. A strict-schema reply that stops at the limit is not an answer: the
// JSON repair step would close its braces and hand back a half-empty object as if it were one, so a
// provider that enforces the schema reports a truncated reply as a failure instead
// (`ProviderPolicy.rejectsTruncatedStructuredReplies`, `utils/providerPolicy.ts`).

/** The three stop-signal vocabularies: OpenAI-compatible, Claude and Gemini. */
export type StopSignalSource = 'openai' | 'claude' | 'gemini';

/** The one stop signal each source uses for "ran out of tokens". */
const TRUNCATING_SIGNAL: Record<StopSignalSource, string> = {
  openai: 'length',
  claude: 'max_tokens',
  gemini: 'MAX_TOKENS',
};

/** What a request branch read off the provider's response next to the reply text. */
export type StopSignal = {
  source: StopSignalSource;
  /** `finish_reason`, `stop_reason` or `finishReason`; absent when the path does not carry it. */
  reason?: string | null;
};

/** True when the provider says the reply hit the output token limit. Unknown or absent is false. */
export function isTruncatedStop(signal: StopSignal | undefined): boolean {
  return signal != null && signal.reason === TRUNCATING_SIGNAL[signal.source];
}
