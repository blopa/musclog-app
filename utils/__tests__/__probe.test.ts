import { Platform } from 'react-native';
import { extractRepCountingFeatures } from '../repCountingFeatures';

it('probe', () => {
  console.log('PLATFORM_OS', Platform.OS);
  console.log('INDEXEDDB', typeof indexedDB);
  const samples = Array.from({ length: 200 }, (_, i) => ({
    timestamp: i * 10,
    accel: { x: 0, y: 0, z: Math.sin((i / 50) * Math.PI * 2) },
    gyro: { x: 0, y: 0, z: 0 },
    angle: { x: 30 * Math.sin((i / 50) * Math.PI * 2), y: 1, z: 0 },
  }));
  const f = extractRepCountingFeatures(samples, {});
  console.log('LEN', f.length);
  console.log('F', JSON.stringify(f.slice(0, 15)));
  console.log('ONEHOT', JSON.stringify(f.slice(15)));
});
