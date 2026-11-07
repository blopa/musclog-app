import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const root = join(__dirname, '..', '..');

/**
 * The files that may draw Loggy (docs/DESIGN.md → "Empty states, decoration and motion"). Adding one is
 * a design decision with a reason, not a convenience: he marks a moment, not a list, and a mascot
 * on every screen stops meaning anything.
 */
const MAY_RENDER_LOGGY: Record<string, string> = {
  'app/app/onboarding/first-workout.tsx': 'the last step of setup, ready to train',
  'app/app/onboarding/landing.tsx':
    'setup opens with him in his default pose; the splash showed the mark',
  'app/app/year-in-review.tsx': 'the year story had nothing to tell, or failed to load',
  'components/ConfettiOverlay.tsx': 'the once-ever firsts bring him with the confetti',
  'components/ConfettiOverlay.web.tsx': 'the once-ever firsts bring him with the confetti',
  'components/LoggyCameo.tsx': 'the timed pop-in-and-leave for those firsts',
  'components/WorkoutSummaryCelebration.tsx': 'the finished workout, in place of the trophy',
  'components/WorkoutSummaryCelebration.web.tsx': 'the finished workout, in place of the trophy',
  'components/comeback/ComebackCard.tsx': 'the offer after a long break only, never the ramp',
  'components/home/YearInReviewCard.tsx': 'the season offer of the year story',
  'components/theme/EmptyStateCard.tsx': 'whole-screen first use only (the `bare` form)',
  'components/weeklyReview/WeeklyReviewWelcome.tsx': 'the one-time introduction',
  'components/whatsNew/WhatsNewIntro.tsx': 'the first page of the tour only',
  'components/whatsNew/WhatsNewPicture.tsx':
    'the pages of the 2.16.0 tour that name a pose (info block `pose`): Loggy, import, year, strength, load',
  'components/workoutImport/ImportOutcomeViews.tsx': 'an import saving, failing or finished',
  'components/workoutImport/ImportPickStep.tsx': 'the import starts',
  'components/workoutImport/ImportUnitStep.tsx': 'the import asks its one question',
  'components/yearInReview/YearShareCard.tsx': 'the shared poster',
  'components/yearInReview/posterKit.tsx': 'each poster of the story',
};

/**
 * The public website's own short list (docs/DESIGN.md → "Website"): `WebsiteLoggy` is his animated
 * SVG as a plain image, not `LoggyPose`, so it is held separately.
 */
const MAY_RENDER_WEBSITE_LOGGY: Record<string, string> = {
  'app/(website)/download.web.tsx': 'the page that starts the install (lifting, ready to train)',
  'app/(website)/exercises.web.tsx': 'no results for a search, in place of the icon (shrug)',
  'app/(website)/faq.web.tsx': 'above the questions (thinking)',
  'app/(website)/home.web.tsx': 'the one introduction on the homepage (wave)',
  'app/(website)/open.web.tsx':
    'the page an assistant link lands on (reading, review before saving)',
};

/** Pages he never appears on: legal text, tools that show a person's numbers, long reading. */
const NEVER_WEBSITE_LOGGY =
  /privacy|terms|contact|calculator|progress|rep-marker|gameboy|alternatives|posts|blog/i;

/** The two screens whose whole-screen empty state passes `pose` to `EmptyStateCard`. */
const EMPTY_STATE_POSE_CALLERS = [
  'app/app/notes.tsx',
  'components/workout/WorkoutLibraryContent.tsx',
];

/** Surfaces he never appears on: the persona owns the coach, the rest are private or sensitive. */
const NEVER_LOGGY = /coach|cycle|lock|menstrual|bodyfat|weight|nutritionGoals|settings/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['__tests__', 'test', 'node_modules'].includes(entry.name) ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = ['app', 'components'].flatMap((dir) =>
  sourceFiles(join(root, dir)).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }))
);

function sourceOf(path: string): string {
  const file = files.find((candidate) => candidate.path === path);
  if (!file) {
    throw new Error(`${path} is missing`);
  }

  return file.source;
}

describe('Loggy placement', () => {
  it('is drawn only by the files the design allows', () => {
    const users = files
      .filter(({ source }) => /<LoggyPose\b|<LoggyCameo\b/.test(source))
      .map(({ path }) => path)
      .sort();

    expect(users).toEqual(Object.keys(MAY_RENDER_LOGGY).sort());
  });

  it('is drawn on the website only by the pages the design allows', () => {
    const users = files
      .filter(({ source }) => /<WebsiteLoggy\b/.test(source))
      .map(({ path }) => path)
      .sort();

    expect(users).toEqual(Object.keys(MAY_RENDER_WEBSITE_LOGGY).sort());
    expect(users.filter((path) => NEVER_WEBSITE_LOGGY.test(path))).toEqual([]);
  });

  it('shows him once on the homepage, as the introduction and nowhere else on it', () => {
    const home = sourceOf('app/(website)/home.web.tsx');

    expect(home.match(/<WebsiteLoggy\b/g)).toHaveLength(1);
    expect(home).toMatch(/export function MeetLoggy\(\)/);
    expect(home.match(/<MeetLoggy \/>/g)).toHaveLength(1);
  });

  // A poster's ground is Loggy's own colour (`POSTER_GROUNDS`), so a themed log could vanish into
  // it: a pink one on the coral poster, a golden one on the yellow. Everywhere else his greens
  // follow the theme, so no other file pins them.
  it('draws him in his classic green on the year story posters, and only there', () => {
    const posterFiles = [
      'components/yearInReview/posterKit.tsx',
      'components/yearInReview/YearShareCard.tsx',
    ];

    for (const path of posterFiles) {
      const poses = sourceOf(path).match(/<LoggyPose\b[\s\S]*?\/>/g) ?? [];

      expect(poses.length).toBeGreaterThan(0);
      expect(poses.filter((pose) => !/appearance="classic"/.test(pose))).toEqual([]);
    }

    expect(
      files
        .filter(({ source }) => /appearance="classic"/.test(source))
        .map(({ path }) => path)
        .sort()
    ).toEqual(posterFiles.sort());
  });

  it('keeps the website off the app component: his image is a file, not LoggyPose', () => {
    const websiteFiles = files.filter(({ path }) => /\(website\)|components\/website\//.test(path));

    expect(websiteFiles.filter(({ source }) => /<LoggyPose\b|<LoggyCameo\b/.test(source))).toEqual(
      []
    );
  });

  it('falls back to the icon when he is hidden where he stands in for it', () => {
    expect(sourceOf('app/(website)/exercises.web.tsx')).toMatch(/loggyVisible \? \(/);
  });

  it('is requested by an empty state only on the two whole-screen first-use screens', () => {
    const callers = files
      .filter(({ source }) =>
        (source.match(/<EmptyStateCard\b[\s\S]*?\/>/g) ?? []).some((block) => /\bpose=/.test(block))
      )
      .map(({ path }) => path)
      .sort();

    expect(callers).toEqual(EMPTY_STATE_POSE_CALLERS);
  });

  it('lets only the whole-screen empty state take a pose, in the type itself', () => {
    expect(sourceOf('components/theme/EmptyStateCard.tsx')).toMatch(
      /\{ bare: true; pose\?: LoggyPoseName \} \| \{ bare\?: false; pose\?: never \}/
    );
  });

  it('leaves the strength levels card without him: a permanent card is a list, not a moment', () => {
    expect(sourceOf('components/progress/StrengthLevelsCard.tsx')).not.toMatch(
      /LoggyPose|LoggyCameo/
    );
  });

  it('never draws him on a coach, cycle, lock, body or settings surface', () => {
    const offenders = files
      .filter(({ path }) => NEVER_LOGGY.test(path))
      .filter(({ source }) => /<LoggyPose\b|<LoggyCameo\b/.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('keeps his confetti cameo out of the coach chat, which the persona owns', () => {
    expect(sourceOf('components/modals/CoachModal.tsx')).toMatch(/confettiWithLoggy=\{false\}/);
  });

  it('keeps the comeback offer plain in the year-review season, so Home shows him once', () => {
    const card = sourceOf('components/comeback/ComebackCard.tsx');

    expect(card).toMatch(/yearReviewSeason\(new Date\(\)\)\.active/);
    expect(card).toMatch(/yearCardSeason \? null : <LoggyPose pose="coffee"/);
  });

  it('lets the workout summary celebrate once, with no second Loggy in its confetti', () => {
    expect(sourceOf('app/app/workout/workout-summary.tsx')).toMatch(
      /<ConfettiOverlay withLoggy=\{false\}/
    );
    expect(sourceOf('components/ConfettiOverlay.tsx')).toMatch(/withLoggy = true/);
    expect(sourceOf('components/ConfettiOverlay.web.tsx')).toMatch(/withLoggy = true/);
  });

  it('draws every failure with the one shared failure pose', () => {
    expect(sourceOf('components/workoutImport/ImportOutcomeViews.tsx')).toMatch(
      /nothingNew \? 'coffee' : LOGGY_FAILURE_POSE/
    );
    expect(sourceOf('app/app/year-in-review.tsx')).toMatch(/pose=\{LOGGY_FAILURE_POSE\}/);
    expect(sourceOf('components/LoggyPose.tsx')).not.toMatch(
      /LOGGY_FAILURE_POSE: LoggyPoseName = 'panic'/
    );
  });

  it('keeps the panic pose for the year story, where it is the busiest month, not a failure', () => {
    const users = files
      .filter(({ source }) => /['"]panic['"]/.test(source))
      .map(({ path }) => path)
      .sort();

    // `LoggyPose.tsx` registers it as a table key (unquoted); the art table is the one place it is
    // chosen by name.
    expect(users).toEqual(['components/yearInReview/yearStoryArt.ts']);
  });
});
