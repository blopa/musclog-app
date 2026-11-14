/** The longest search a `?q=` link may pre-fill: a longer value is treated as no search. */
export const MAX_EXERCISE_QUERY_LENGTH = 100;

/**
 * Reads the `q` parameter of a query string (`?q=Barbell+Squat`) for the `/exercises` search box.
 * Pure, so it can be tested without a browser; the page reads `window.location.search` AFTER
 * hydration, because the static HTML cannot know the query and a lazy state initializer would make
 * the first client render differ from the server's. A missing, blank or oversized value is `''`.
 */
export function exerciseSearchFromQuery(queryString: string): string {
  let value: string | null;

  try {
    value = new URLSearchParams(queryString).get('q');
  } catch {
    return '';
  }

  const trimmed = (value ?? '').trim();

  return trimmed.length > MAX_EXERCISE_QUERY_LENGTH ? '' : trimmed;
}

/** The `/exercises` link that opens the library already searching for `name`. */
export function exerciseSearchPath(name: string): string {
  return `/exercises?q=${encodeURIComponent(name)}`;
}
