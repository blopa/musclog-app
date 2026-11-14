import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Phones3D, toUnitsX } from '../components/Phones3D';
import { FloatCard } from '../components/FloatCard';
import { Chips, Headline, Label, Sub } from '../components/Text';

/** The copy column of a feature scene. */
const Copy: React.FC<{
  left: number;
  top?: number;
  label: string;
  headline: string;
  accent: string[];
  sub: string;
  chips?: string[];
  width?: number;
}> = ({ left, top = 300, label, headline, accent, sub, chips, width = 680 }) => (
  <div style={{ position: 'absolute', left, top, width }}>
    <Label text={label} delay={4} />
    <Headline text={headline} accent={accent} delay={8} />
    <Sub text={sub} delay={26} style={{ marginTop: 28 }} />
    {chips ? <Chips items={chips} delay={44} style={{ marginTop: 40 }} /> : null}
  </div>
);

export const HomeScene: React.FC = () => (
  <AbsoluteFill>
    <Phones3D
      phones={[
        {
          screen: 'screens/01-home.png',
          x: toUnitsX(1430),
          y: -0.05,
          z: 0,
          height: 4.1,
          rotY: -0.34,
          rotZ: 0.03,
          delay: 4,
          drift: 0.12,
        },
      ]}
    />
    <FloatCard src="kcal" left={850} top={300} width={500} tiltY={14} delay={36} from="left" />
    <FloatCard
      src="actions"
      left={900}
      top={640}
      width={430}
      tiltY={14}
      delay={50}
      phase={1.4}
      from="left"
    />
    <Copy
      left={130}
      label="Home"
      headline={'Your day\nat a glance'}
      accent={['day']}
      sub="Calories, macros and today's workout on one screen."
      width={640}
    />
  </AbsoluteFill>
);

export const WorkoutScene: React.FC = () => (
  <AbsoluteFill>
    <Phones3D
      phones={[
        {
          screen: 'screens/02-workout.png',
          x: toUnitsX(480),
          y: -0.05,
          z: 0,
          height: 4.1,
          rotY: 0.36,
          rotZ: -0.03,
          delay: 4,
          from: 'left',
          drift: -0.12,
        },
      ]}
    />
    <FloatCard src="insight" left={620} top={210} width={470} tiltY={-14} delay={34} from="right" />
    <FloatCard
      src="setrow"
      left={650}
      top={470}
      width={500}
      tiltY={-14}
      delay={48}
      phase={2}
      from="right"
    />
    <Copy
      left={1230}
      label="Workouts"
      headline={'Log every set\nas you train'}
      accent={['set']}
      sub="Rest timer, warm-ups and a target for every set."
      chips={['Rest timer', 'Warm-ups', 'Supersets', 'Plate math']}
      width={620}
    />
  </AbsoluteFill>
);

export const FoodScene: React.FC = () => (
  <AbsoluteFill>
    <Phones3D
      phones={[
        {
          screen: 'screens/03-food-details.png',
          x: toUnitsX(1700),
          y: 0.15,
          z: -1.4,
          height: 3.8,
          rotY: -0.5,
          rotZ: 0.04,
          delay: 16,
          from: 'right',
          phase: 1.7,
        },
        {
          screen: 'screens/04-food.png',
          x: toUnitsX(1290),
          y: -0.1,
          z: 0,
          height: 4.0,
          rotY: -0.26,
          rotZ: 0.02,
          delay: 4,
          drift: 0.1,
        },
      ]}
    />
    <FloatCard
      src="stepper"
      left={1420}
      top={150}
      width={400}
      tiltY={10}
      delay={60}
      phase={0.8}
      from="right"
    />
    <FloatCard src="breakfast" left={790} top={540} width={480} tiltY={14} delay={38} from="left" />
    <Copy
      left={130}
      label="Nutrition"
      headline={'Track food\nyour way'}
      accent={['food']}
      sub="Search, scan a barcode or build your own meals."
      chips={['Barcode scan', 'Macros', 'Saved meals']}
      width={620}
    />
  </AbsoluteFill>
);

export const ProgressScene: React.FC = () => (
  <AbsoluteFill>
    <Phones3D
      phones={[
        {
          screen: 'screens/06-past-workout.png',
          x: toUnitsX(250),
          y: 0.2,
          z: -1.4,
          height: 3.8,
          rotY: 0.42,
          rotZ: -0.04,
          delay: 16,
          from: 'left',
          phase: 2.4,
        },
        {
          screen: 'screens/05-progress.png',
          x: toUnitsX(520),
          y: -0.1,
          z: 0,
          height: 4.0,
          rotY: 0.3,
          rotZ: -0.02,
          delay: 4,
          drift: -0.1,
        },
      ]}
    />
    <FloatCard src="weight" left={760} top={210} width={380} tiltY={-14} delay={36} from="right" />
    <Copy
      left={1230}
      label="Progress"
      headline={'Watch your\nprogress'}
      accent={['progress']}
      sub="Weight trends, personal records and the muscles each workout worked."
      chips={['Charts', 'Records', 'Muscle map']}
      width={620}
    />
  </AbsoluteFill>
);

export const ReviewScene: React.FC = () => (
  <AbsoluteFill>
    <Phones3D
      phones={[
        {
          screen: 'screens/08-goals.png',
          x: toUnitsX(1710),
          y: 0.15,
          z: -1.4,
          height: 3.8,
          rotY: -0.5,
          rotZ: 0.04,
          delay: 16,
          from: 'right',
          phase: 0.9,
        },
        {
          screen: 'screens/07-weekly-review.png',
          x: toUnitsX(1300),
          y: -0.1,
          z: 0,
          height: 4.0,
          rotY: -0.28,
          rotZ: 0.02,
          delay: 4,
          drift: 0.1,
        },
      ]}
    />
    <FloatCard
      src="target"
      left={1440}
      top={130}
      width={380}
      tiltY={10}
      delay={56}
      phase={1.1}
      from="right"
    />
    <FloatCard src="training" left={800} top={560} width={470} tiltY={14} delay={36} from="left" />
    <Copy
      left={130}
      label="Weekly Review"
      headline={'Review your\nweek'}
      accent={['week']}
      sub="Calorie targets that follow your real weight trend."
      width={620}
    />
  </AbsoluteFill>
);
