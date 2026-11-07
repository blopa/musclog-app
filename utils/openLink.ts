/**
 * Open links: a URL that carries a payload from outside the app (an assistant's reply, a message)
 * into it, e.g. `https://musclog.app/open#workout=<percent-encoded JSON>`.
 *
 * Pure on purpose (no React Native imports): the native intent handler, the `/open` bridge page
 * and the tests all read it. The payload travels in the URL FRAGMENT, which browsers never send
 * to a server, so a workout or a food log is not seen by the host or its logs.
 *
 * Two spellings reach the app, and they mean the same thing:
 * - `https://musclog.app/open` is claimed by the OS (Android App Links, iOS Universal Links);
 *   only that exact path is claimed (see `app.json` and `public/.well-known/`).
 * - `com.werules.logger://open` is what the bridge page's "Open in Musclog" button uses, because
 *   a tap is what lets a browser launch a custom scheme when the OS did not open the https link.
 */

export const OPEN_LINK_SCHEME = 'com.werules.logger';
export const OPEN_LINK_PATH = '/open';

/** What a link can carry. Each kind opens the screen that owns the matching import. */
export const OPEN_LINK_KINDS = ['workout', 'food'] as const;
export type OpenLinkKind = (typeof OPEN_LINK_KINDS)[number];

export type OpenLink = { kind: OpenLinkKind; payload: string };

export const OPEN_LINK_ROUTES: Record<OpenLinkKind, string> = {
  workout: '/app/workout/workouts',
  food: '/app/nutrition/food',
};

/** Same ceiling as an imported setup file (`MAX_CONTRACT_BYTES`), counted in characters. */
export const MAX_OPEN_LINK_PAYLOAD_CHARS = 64 * 1024;

const HTTPS_OPEN_URL = /^https:\/\/musclog\.app\/open\/?(?:\?[^#]*)?$/i;
const SCHEME_OPEN_URL = /^com\.werules\.logger:\/\/\/?open\/?(?:\?[^#]*)?$/i;

function isOpenLinkKind(value: string): value is OpenLinkKind {
  return (OPEN_LINK_KINDS as readonly string[]).includes(value);
}

/** An assistant can mangle an escape; a payload that does not decode is still handed on as typed. */
function decodePayload(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Reads `kind=<payload>` from a URL fragment (with or without the leading `#`). Everything after
 * the FIRST `=` is the payload: JSON holds `&` and `=`, so the fragment is never split further.
 * Returns null for an unknown kind, an empty payload or one over the size ceiling.
 */
export function parseOpenFragment(fragment: string): OpenLink | null {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const separator = text.indexOf('=');
  if (separator < 0) {
    return null;
  }

  const kind = text.slice(0, separator).trim().toLowerCase();
  const raw = text.slice(separator + 1);
  if (!isOpenLinkKind(kind) || raw.length === 0 || raw.length > MAX_OPEN_LINK_PAYLOAD_CHARS) {
    return null;
  }

  const payload = decodePayload(raw).trim();
  return payload.length > 0 ? { kind, payload } : null;
}

export type OpenLinkParse = { matches: false } | { matches: true; link: OpenLink | null };

/**
 * `matches` says whether the URL is an open link at all; `link` is its payload, or null when the
 * link carries nothing usable (the app then just opens).
 */
export function parseOpenLink(url: string): OpenLinkParse {
  const hashIndex = url.indexOf('#');
  const head = hashIndex < 0 ? url : url.slice(0, hashIndex);
  if (!HTTPS_OPEN_URL.test(head) && !SCHEME_OPEN_URL.test(head)) {
    return { matches: false };
  }

  return { matches: true, link: hashIndex < 0 ? null : parseOpenFragment(url.slice(hashIndex)) };
}

/** The custom-scheme twin of an open link, for the bridge page's "Open in Musclog" button. */
export function buildOpenSchemeUrl(link: OpenLink): string {
  return `${OPEN_LINK_SCHEME}://open#${link.kind}=${encodeURIComponent(link.payload)}`;
}

let pending: OpenLink | null = null;

/** The payload of the link that opened the app, kept for the screen it routed to. */
export function setPendingOpenLink(link: OpenLink | null) {
  pending = link;
}

/** Hands the pending payload to its screen exactly once; another kind's payload stays put. */
export function takePendingOpenLink(kind: OpenLinkKind): OpenLink | null {
  if (!pending || pending.kind !== kind) {
    return null;
  }

  const link = pending;
  pending = null;
  return link;
}
