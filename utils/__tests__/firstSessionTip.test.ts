import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

describe('first session tip', () => {
  it('is mounted in the live session and only for people with no finished workout', () => {
    expect(read('components/workout/WorkoutTrainingView.tsx')).toContain('<FirstSessionTip');
    const tip = read('components/workout/session/FirstSessionTip.tsx');
    expect(tip).toContain('getCompletedWorkoutCount()');
    expect(tip).toContain('WORKOUT_FIRST_TIP_SEEN');
  });
});
