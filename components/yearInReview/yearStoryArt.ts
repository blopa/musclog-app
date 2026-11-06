import type { LoggyPoseName } from '@/components/LoggyPose';
import type { PosterGroundName } from '@/constants/loggyPalette';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';

type StoryArt = {
  ground: PosterGroundName;
  pose: LoggyPoseName | null;
  /** Height of the mascot as a share of the poster. */
  poseShare: number;
};

/**
 * Each card's ground, pose and pose size. The pose is the card's joke (the longest run is running,
 * the busiest month is a panic), never praise. The calendar has no pose because the year fills the
 * poster. Neighbouring cards sit on different grounds, so moving on always reads as a new page.
 */
export const YEAR_STORY_ART: Record<YearStoryCard['kind'], StoryArt> = {
  intro: { ground: 'yellow', pose: 'wave', poseShare: 0.58 },
  sessions: { ground: 'sky', pose: 'default', poseShare: 0.5 },
  heatmap: { ground: 'paper', pose: null, poseShare: 0.5 },
  streak: { ground: 'coral', pose: 'running', poseShare: 0.46 },
  volume: { ground: 'ink', pose: 'flex', poseShare: 0.46 },
  topExercises: { ground: 'yellow', pose: 'magnify', poseShare: 0.46 },
  records: { ground: 'sky', pose: 'celebrating', poseShare: 0.56 },
  busiestMonth: { ground: 'coral', pose: 'panic', poseShare: 0.44 },
  trainingTime: { ground: 'tan', pose: 'coffee', poseShare: 0.32 },
  nutrition: { ground: 'sky', pose: 'writing', poseShare: 0.5 },
  foodStreak: { ground: 'coral', pose: 'running', poseShare: 0.3 },
  favouriteMeal: { ground: 'yellow', pose: 'thinking', poseShare: 0.38 },
  protein: { ground: 'ink', pose: 'drinking', poseShare: 0.38 },
  macros: { ground: 'tan', pose: 'magnify', poseShare: 0.4 },
  weight: { ground: 'paper', pose: 'thinking', poseShare: 0.5 },
  outro: { ground: 'ink', pose: 'wave', poseShare: 0.38 },
};
