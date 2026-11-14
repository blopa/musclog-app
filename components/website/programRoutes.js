/**
 * The free workout programs on the website (/programs and /programs/<slug>), as plain CommonJS
 * because `scripts/generate-web-seo-files.js` runs outside the bundle and must read the same
 * slugs the router builds pages for (the same arrangement as `blogRoutes.js`).
 *
 * A slug is chosen per program and keyed by the bundled template's `__title` in
 * `data/workoutTemplatesData.json`, which is stable. Never derive a slug from the template's
 * position in the array or from its translated title: either would silently move a URL. The
 * order of this table is the order the index lists programs in, most searched-for first.
 * `components/website/programs/__tests__/programsModel.test.ts` pins that every bundled template
 * has exactly one slug and every slug names a template.
 */
const PROGRAM_SLUGS_BY_TEMPLATE_TITLE = {
  'Push Pull Legs (PPL)': 'push-pull-legs',
  'Upper/Lower 4-Day Split': 'upper-lower-4-day',
  'Full Body (3-Day)': 'full-body-3-day',
  'PHUL (Power Hypertrophy Upper Lower)': 'phul',
  '5-Day Hypertrophy Split': '5-day-hypertrophy-split',
  'Arnold Split (6-Day)': 'arnold-split',
  'Bro Split (5-Day)': 'bro-split',
  '2-Day Full Body (A/B)': '2-day-full-body',
  '3-Day Strength Builder': '3-day-strength-builder',
  'Classic 3-Day (Chest/Tri, Back/Bi, Legs/Shoulders)': 'classic-3-day-split',
  'Brolic Workout': 'brolic-workout',
  'Cable Superset Workout': 'cable-superset-workout',
  'Short Full Body — Gym': 'short-full-body-gym',
  'Short Full Body — Home': 'short-full-body-home',
  'Short Full Body — No Equipment': 'short-full-body-no-equipment',
};

const SAFE_PROGRAM_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const PROGRAM_SLUGS = Object.values(PROGRAM_SLUGS_BY_TEMPLATE_TITLE);

function programPath(slug) {
  if (!SAFE_PROGRAM_SLUG.test(slug)) {
    throw new Error(`Invalid program slug for a public URL: ${slug}`);
  }

  return `/programs/${slug}`;
}

module.exports = {
  PROGRAM_SLUGS,
  PROGRAM_SLUGS_BY_TEMPLATE_TITLE,
  SAFE_PROGRAM_SLUG,
  programPath,
};
