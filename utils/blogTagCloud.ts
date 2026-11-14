/**
 * How big a tag is drawn in the tag cloud. Pure, so the sizing rule is testable without a browser.
 *
 * Counts are heavily skewed (one tag on every post, most on one or two), so a linear scale would
 * leave nearly everything at the smallest size. A logarithmic one keeps the busiest tag clearly
 * biggest while still telling a tag with three posts from a tag with one.
 */
export const TAG_CLOUD_LEVELS = 5;

/**
 * The size step (0 = smallest, `TAG_CLOUD_LEVELS - 1` = biggest) for a tag with `count` posts, given
 * the least and most popular counts across all tags. When every tag has the same count there is
 * nothing to rank, so they all take the middle step instead of all looking "least popular".
 */
export function tagCloudLevel(count: number, min: number, max: number): number {
  const top = TAG_CLOUD_LEVELS - 1;
  if (max <= min) {
    return Math.floor(top / 2);
  }

  const share = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return Math.min(top, Math.max(0, Math.round(share * top)));
}
