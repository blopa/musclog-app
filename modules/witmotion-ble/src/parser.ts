import { Buffer } from 'buffer';

import type { WitMotionLiveData, WitMotionPacket, WitMotionVector3 } from './types';

function readShortLE(buffer: Buffer, offset: number) {
  return buffer.readInt16LE(offset);
}

function parseVector(buffer: Buffer, offset: number, scale: number): WitMotionVector3 {
  return {
    x: (readShortLE(buffer, offset) / 32768) * scale,
    y: (readShortLE(buffer, offset + 2) / 32768) * scale,
    z: (readShortLE(buffer, offset + 4) / 32768) * scale,
  };
}

export function batteryVoltageToPercent(voltage: number) {
  if (voltage > 3.96) {
    return 100;
  }
  if (voltage > 3.93) {
    return 90;
  }
  if (voltage > 3.87) {
    return 75;
  }
  if (voltage > 3.82) {
    return 60;
  }
  if (voltage > 3.79) {
    return 50;
  }
  if (voltage > 3.77) {
    return 40;
  }
  if (voltage > 3.73) {
    return 30;
  }
  if (voltage > 3.7) {
    return 20;
  }
  if (voltage > 3.68) {
    return 15;
  }
  if (voltage > 3.5) {
    return 10;
  }
  if (voltage > 3.4) {
    return 5;
  }

  return 0;
}

export function createEmptyLiveData(): WitMotionLiveData {
  return {
    accel: null,
    gyro: null,
    angle: null,
    magnetic: null,
    batteryVoltage: null,
    batteryPercent: null,
    updatedAt: null,
  };
}

export function applyPacketToLiveData(
  current: WitMotionLiveData,
  packet: WitMotionPacket
): WitMotionLiveData {
  switch (packet.kind) {
    case 'motion':
      return {
        ...current,
        accel: packet.accel,
        gyro: packet.gyro,
        angle: packet.angle,
        updatedAt: packet.timestamp,
      };
    case 'magnetic':
      return {
        ...current,
        magnetic: packet.magnetic,
        updatedAt: packet.timestamp,
      };
    case 'battery':
      return {
        ...current,
        batteryVoltage: packet.voltage,
        batteryPercent: packet.percent,
        updatedAt: packet.timestamp,
      };
    default:
      return current;
  }
}

export function parseWitMotionPackets(base64Payload: string): WitMotionPacket[] {
  const buffer = Buffer.from(base64Payload, 'base64');
  const packets: WitMotionPacket[] = [];

  let offset = 0;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0x55) {
      offset += 1;
      continue;
    }

    const type = buffer[offset + 1];
    const timestamp = Date.now();

    if (type === 0x61) {
      if (offset + 20 > buffer.length) {
        break;
      }

      const accel = parseVector(buffer, offset + 2, 16);
      const gyro = parseVector(buffer, offset + 8, 2000);
      const angle = parseVector(buffer, offset + 14, 180);

      packets.push({ kind: 'motion', timestamp, accel, gyro, angle });
      offset += 20;
      continue;
    }

    if (type === 0x71) {
      const remaining = buffer.length - offset;
      if (remaining < 11) {
        break;
      }

      const frameLength = remaining >= 20 ? 20 : 11;
      const subtype = buffer[offset + 2];

      if (subtype === 58) {
        const magnetic = {
          x: readShortLE(buffer, offset + 4) / 120,
          y: readShortLE(buffer, offset + 6) / 120,
          z: readShortLE(buffer, offset + 8) / 120,
        };

        packets.push({ kind: 'magnetic', timestamp, magnetic });
      } else if (subtype === 100) {
        const voltage = readShortLE(buffer, offset + 4) / 100;
        packets.push({
          kind: 'battery',
          timestamp,
          voltage,
          percent: batteryVoltageToPercent(voltage),
        });
      }

      offset += frameLength;
      continue;
    }

    offset += 1;
  }

  return packets;
}
