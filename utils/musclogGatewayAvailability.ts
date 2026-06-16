import { Platform } from 'react-native';

import { isProduction } from '@/utils/app';

export function isMusclogGatewayAvailable(): boolean {
  return Platform.OS !== 'web' || !isProduction();
}

export function effectiveUseMusclogGateway(enabled: boolean): boolean {
  return enabled && isMusclogGatewayAvailable();
}
