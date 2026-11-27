/**
 * The last turn of a coach reply's review round (highest thinking level). The system prompt and the
 * history are the chat's own, and the conversation already ends with the person's message and the
 * draft written for it as the model's own previous reply, so nothing is quoted here and there are
 * no markers for a small model to copy back into its answer.
 *
 * It is the one second pass no code judges, so it is a checklist, not an open "improve this": four
 * named checks, and a draft that passes all of them comes back UNCHANGED. An open review can make a
 * correct answer worse (longer, more hedged, a different voice), and nothing downstream would notice.
 */
export const getChatReviewInstruction = (language: string): string =>
  [
    "Review round. Your previous reply above is a draft of the answer to the person's last message; it has not been sent.",
    'Run the draft through these four checks, against the conversation so far and against the app data in your instructions (profile, snapshot, workouts, meals):',
    '1. Facts: a number or fact in the draft that contradicts the app data or the conversation. Fix it.',
    '2. Unsupported claims: a claim about the person that nothing in the conversation or the app data supports. Remove it.',
    '3. Safety: if the message or the data involves pain or injury symptoms, signs of an eating disorder, an extreme calorie deficit, pregnancy or medication, narrow the advice, give no optimisation advice that could cause harm, and suggest a qualified professional.',
    `4. Fit: the draft answers what was asked, in your persona voice, within the length rules, in the language the person writes in (the app language is ${language}). If it does not, fix that.`,
    'If the draft passes all four checks, reply with the draft UNCHANGED, word for word. Do not polish it, add to it, lengthen it or change its voice; change only what a check above requires.',
    'Use the same reply format as the draft.',
    'Write only the reply the person will read. Never mention that a draft, a review or a second pass exists.',
  ].join('\n');

/**
 * Added to an extraction's own user message (a label, past workouts, a food log) when
 * independent readings of the same input disagreed (High and Tokenmaxxing thinking levels). The
 * readings are quoted as data, so whatever they say is checked, never followed.
 */
export const getExtractionArbiterMessage = (readings: unknown[], disputed: string[]): string =>
  [
    'Independent readings of this same input disagree on some fields.',
    'Read the input again and return the complete, corrected answer in the same format.',
    'Decide each disputed field from the input itself; a reading is not evidence.',
    '',
    `Disputed fields: ${disputed.slice(0, 40).join(', ')}`,
    '',
    ...readings.flatMap((reading, index) => [
      `--- READING ${index + 1} ---`,
      JSON.stringify(reading),
      `--- END OF READING ${index + 1} ---`,
    ]),
  ].join('\n');

/**
 * The last user turn of a plan's critique round (High and Tokenmaxxing thinking levels). The
 * original request and the answer under review are already in the conversation (the answer as the
 * model's own previous message), so this carries only what code found in it.
 */
export const getPlanReviewInstruction = (findings: string[]): string =>
  [
    'Review round. Your previous message is an answer already written for the request above.',
    'Check it against the request and the rules above, then return the complete, corrected answer in the same format.',
    'Keep what is right; fix what breaks the request, the rules or the numbers. Do not change it just to change it.',
    '',
    'Problems found by code:',
    ...(findings.length > 0 ? findings.slice(0, 40).map((finding) => `- ${finding}`) : ['- none']),
  ].join('\n');

/**
 * The last user turn of an insight's fact-check round (High and Tokenmaxxing thinking levels). The
 * system prompt, the request and the draft (the model's own previous message) are the ones it just
 * answered, so the data and the voice stay the same. On a later round the text may also be tightened.
 */
export const getInsightFactCheckInstruction = (ungrounded: string[], tighten: boolean): string =>
  [
    'Fact-check round. Your previous message is a draft answer written for the request above from the data above.',
    'Return the same answer with every figure and claim checked against the data: fix what the data does not support, and remove what you cannot check. A sum, average or difference worked out correctly from the data may stay.',
    tighten
      ? 'Also tighten the wording: say the same things in fewer words, with the same facts.'
      : 'Change nothing else: same language, same voice, same length.',
    'Reply with the answer only, never mentioning a draft or a check.',
    '',
    ungrounded.length > 0
      ? `Figures not found in the data: ${ungrounded.slice(0, 30).join(', ')}`
      : 'Every figure was found in the data; check the claims around them.',
  ].join('\n');
