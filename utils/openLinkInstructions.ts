import { OPEN_LINK_BASE_URL, OPEN_LINK_SUGGESTED_MAX_CHARS, type OpenLinkKind } from './openLink';

/**
 * The steps that end an assistant's brief: turn the confirmed JSON into one tappable link that
 * opens Musclog on the review screen, keep the JSON itself as a fallback, and say how to use both.
 * Shared by the workout-plan and food-log prompts so the encoding rule is written once. Kept out of
 * `openLink.ts` so that module, which the startup path imports, stays small.
 *
 * `firstStep` is the number of the first step, so the list continues the prompt's own numbering.
 */
export function buildOpenLinkSteps({
  kind,
  fileName,
  firstStep,
}: {
  kind: OpenLinkKind;
  fileName: string;
  firstStep: number;
}): string[] {
  const steps = [
    'Minify the JSON: no spaces and no line breaks outside of strings.',
    "Percent-encode the minified JSON: every character except A-Z a-z 0-9 - _ . ~ becomes %XX (UTF-8 bytes). That includes spaces, quotes, braces, commas, colons and also ( ) ! ' *, because an unescaped \")\" ends a link early. If you can run code, use Python: urllib.parse.quote(minified, safe=''), then decode the link back and check it equals the JSON.",
    `Write one markdown link, exactly: [Open in Musclog](${OPEN_LINK_BASE_URL}#${kind}=<encoded JSON>). The fragment is "${kind}=" followed by the encoded JSON: no query string, and nothing else in the URL.`,
    `If you cannot encode it reliably, or the link would be longer than ${OPEN_LINK_SUGGESTED_MAX_CHARS} characters, skip the link and say so.`,
    'Always put the same JSON right after the link in one single JSON code block and nothing else inside the block, introduced as the fallback: "If the link does not open Musclog, copy this block (or the link) and use Paste JSON in Musclog." If you could not validate the JSON, say so explicitly.',
    `If you can create files, you may also attach the JSON as a downloadable file named ${fileName}.`,
    'Finish by telling the person to open the link on the phone that has Musclog installed. Their chat app may ask them to confirm opening an external link; that is expected.',
  ];

  return steps.map((step, index) => `${firstStep + index}. ${step}`);
}
