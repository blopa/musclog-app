// Manual mock for `@kingstinct/react-native-healthkit`. Its entry point loads
// `react-native-nitro-modules`, which calls `TurboModuleRegistry.getEnforcing('NitroModules')`
// at import time and throws outside a real native binary. `services/healthConnectFitness.ios.ts`
// is the consumer that drags it into the graph (the RN Jest preset resolves `.ios.ts`).

module.exports = {
  AuthorizationStatus: {
    notDetermined: 0,
    sharingDenied: 1,
    sharingAuthorized: 2,
  },
  authorizationStatusFor: jest.fn().mockResolvedValue(0),
  isHealthDataAvailable: jest.fn().mockResolvedValue(false),
  queryQuantitySamples: jest.fn().mockResolvedValue([]),
  requestAuthorization: jest.fn().mockResolvedValue(false),
  saveQuantitySample: jest.fn().mockResolvedValue(false),
};
