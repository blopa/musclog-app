import { Image, type ImageSourcePropType } from 'react-native';

export type LoggyPoseName =
  | 'celebrating'
  | 'coffee'
  | 'default'
  | 'flex'
  | 'magnify'
  | 'panic'
  | 'running'
  | 'thinking'
  | 'wave'
  | 'writing';

/** Width over height of each pose; the artwork's canvases differ. */
const POSES: Record<LoggyPoseName, { source: ImageSourcePropType; aspect: number }> = {
  celebrating: {
    source: require('../assets/avatars/loggy-poses/loggy-celebrating.png'),
    aspect: 0.876,
  },
  coffee: { source: require('../assets/avatars/loggy-poses/loggy-coffee.png'), aspect: 0.859 },
  default: { source: require('../assets/avatars/loggy-poses/loggy-default.png'), aspect: 0.8 },
  flex: { source: require('../assets/avatars/loggy-poses/loggy-flex.png'), aspect: 0.8 },
  magnify: { source: require('../assets/avatars/loggy-poses/loggy-magnify.png'), aspect: 0.843 },
  panic: { source: require('../assets/avatars/loggy-poses/loggy-panic.png'), aspect: 0.8 },
  running: { source: require('../assets/avatars/loggy-poses/loggy-running.png'), aspect: 0.876 },
  thinking: { source: require('../assets/avatars/loggy-poses/loggy-thinking.png'), aspect: 0.767 },
  wave: { source: require('../assets/avatars/loggy-poses/loggy-wave.png'), aspect: 0.876 },
  writing: { source: require('../assets/avatars/loggy-poses/loggy-writing.png'), aspect: 0.8 },
};

type LoggyPoseProps = {
  pose: LoggyPoseName;
  height: number;
};

/** The mascot at a given height. Always decorative: the words around it carry the meaning. */
export function LoggyPose({ pose, height }: LoggyPoseProps) {
  const { source, aspect } = POSES[pose];

  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      source={source}
      style={{ height, width: height * aspect }}
    />
  );
}
