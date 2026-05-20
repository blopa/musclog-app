# witmotion-ble

Local WIT Motion BLE helpers for the Musclog Expo app.

## Usage

```ts
import { useWitMotionScanner } from '@/modules/witmotion-ble';

const { discoveredDevices, startScan, connect, connectedDevice, status, liveData } =
  useWitMotionScanner();
```

The module uses the app's existing `react-native-ble-plx` setup and mirrors the Android Java demo:

- scan for devices whose names start with `WT`
- connect to the WIT GATT service
- subscribe to the live sensor stream
- poll magnetic field and battery updates
- expose command helpers for output rate, bandwidth, zero angle, and calibration
