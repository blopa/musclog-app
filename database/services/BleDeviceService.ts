import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import BleDevice from '@/database/models/BleDevice';
import type { WitMotionDevice } from '@/modules/witmotion-ble';

export class BleDeviceService {
  static async getAll(): Promise<BleDevice[]> {
    return database
      .get<BleDevice>('ble_devices')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('last_connected_at', Q.desc))
      .fetch();
  }

  static async findByDeviceId(deviceId: string): Promise<BleDevice | null> {
    const results = await database
      .get<BleDevice>('ble_devices')
      .query(Q.where('device_id', deviceId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return results[0] ?? null;
  }

  static async saveDevice(device: WitMotionDevice): Promise<BleDevice> {
    const existing = await BleDeviceService.findByDeviceId(device.id);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    return database.write(async () => {
      return database.get<BleDevice>('ble_devices').create((record) => {
        record.deviceId = device.id;
        record.name = device.name;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }
}
