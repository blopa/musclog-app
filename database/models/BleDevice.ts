import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export default class BleDevice extends Model {
  static table = 'ble_devices';

  @field('device_id') deviceId!: string;
  @field('name') name!: string;
  @field('nickname') nickname?: string;
  @field('last_connected_at') lastConnectedAt?: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  get displayName(): string {
    return this.nickname || this.name;
  }

  @writer async rename(nickname: string): Promise<void> {
    await this.update((r) => {
      r.nickname = nickname;
      r.updatedAt = Date.now();
    });
  }

  @writer async markConnected(): Promise<void> {
    await this.update((r) => {
      r.lastConnectedAt = Date.now();
      r.updatedAt = Date.now();
    });
  }

  @writer async markAsDeleted(): Promise<void> {
    await this.update((r) => {
      r.deletedAt = Date.now();
      r.updatedAt = Date.now();
    });
  }
}
