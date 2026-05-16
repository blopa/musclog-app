import { View } from 'react-native';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Sample {
  timestamp: number;
  accel: Vector3D;
  gyro: Vector3D;
  angle: Vector3D;
}

export interface Analysis {
  repCount: number;
  sampleCount: number;
  durationMs: number;
}

export interface DebugData {
  version: number;
  startedAt: string;
  stoppedAt: string;
  sampleCount: number;
  analysis: Analysis;
  samples: Sample[];
}

export default function Test() {
  return <View>{'TODO'}</View>;
}
