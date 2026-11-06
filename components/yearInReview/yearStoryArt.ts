import type { LoggyPoseName } from '@/components/LoggyPose';
import type { PosterGroundName } from '@/constants/loggyPalette';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';

type StoryArt = { ground: PosterGroundName; pose: LoggyPoseName | null };

/**
 * Each card's ground and pose. The pose is the card's joke (the longest run is running, the busiest
 * month is a panic), never praise. The calendar has no pose because the year fills the poster.
 * Neighbouring cards sit on different grounds, so moving on always reads as a new page.
 */
export const YEAR_STORY_ART: Record<YearStoryCard['kind'], StoryArt> = {
  intro: { ground: 'yellow', pose: 'wave' },
  sessions: { ground: 'sky', pose: 'default' },
  heatmap: { ground: 'paper', pose: null },
  streak: { ground: 'coral', pose: 'running' },
  volume: { ground: 'ink', pose: 'flex' },
  topExercises: { ground: 'yellow', pose: 'magnify' },
  records: { ground: 'sky', pose: 'celebrating' },
  busiestMonth: { ground: 'coral', pose: 'panic' },
  trainingTime: { ground: 'tan', pose: 'coffee' },
  nutrition: { ground: 'sky', pose: 'writing' },
  foodStreak: { ground: 'coral', pose: 'running' },
  favouriteMeal: { ground: 'yellow', pose: 'thinking' },
  protein: { ground: 'ink', pose: 'drinking' },
  macros: { ground: 'tan', pose: 'magnify' },
  weight: { ground: 'paper', pose: 'thinking' },
  outro: { ground: 'ink', pose: 'wave' },
};
