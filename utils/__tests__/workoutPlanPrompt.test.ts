import { buildWorkoutPlanExerciseSection } from '../workoutPlanPrompt';

const exercises = [
  { id: 'fx-Bench_Press', name: 'Bench Press' },
  { id: 'fx-Squat', name: 'Squat' },
];

const joined = (lines: string[]) => lines.join('\n');

describe('buildWorkoutPlanExerciseSection', () => {
  it('lists exactly the exercises it is given, by id and name', () => {
    const text = joined(buildWorkoutPlanExerciseSection({ exercises }));

    expect(text).toContain('"id": "fx-Bench_Press"');
    expect(text).toContain('"name": "Squat"');
    expect(text).toContain('You MUST only use exercises from the list below');
  });

  it('does not mention equipment or dislikes when there is nothing to say', () => {
    const text = joined(buildWorkoutPlanExerciseSection({ exercises }));

    expect(text).not.toContain('trains at');
    expect(text).not.toContain('dislikes');
  });

  it('tells the model which gym the plan is for', () => {
    const text = joined(
      buildWorkoutPlanExerciseSection({
        exercises,
        gym: { name: 'Home Gym', equipment: ['barbell', 'dumbbell'] },
      })
    );

    expect(text).toContain('"Home Gym"');
    expect(text).toContain('barbell, dumbbell');
  });

  it('still describes the equipment when the gym has no name', () => {
    expect(
      joined(buildWorkoutPlanExerciseSection({ exercises, gym: { equipment: ['cable'] } }))
    ).toContain('trains at a gym, which has: cable');
  });

  it('skips the gym line for a gym with no equipment listed', () => {
    expect(
      joined(buildWorkoutPlanExerciseSection({ exercises, gym: { name: 'Empty', equipment: [] } }))
    ).not.toContain('trains at');
  });

  it('asks the model to avoid disliked exercises without forbidding them', () => {
    const text = joined(buildWorkoutPlanExerciseSection({ exercises, dislikedNames: ['Squat'] }));

    expect(text).toContain('prefer others');
    expect(text).toContain('Squat');
  });

  it('copes with an exercise that has no name', () => {
    expect(
      joined(buildWorkoutPlanExerciseSection({ exercises: [{ id: 'x', name: null }] }))
    ).toContain('"name": ""');
  });
});
