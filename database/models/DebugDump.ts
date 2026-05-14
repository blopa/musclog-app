import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type DebugDumpDirection = 'request' | 'response';

export default class DebugDump extends Model {
  static table = 'debug_dump';

  @field('provider') provider!: string;
  @field('direction') direction!: DebugDumpDirection;
  @field('operation') operation!: string;
  @field('payload_json') payloadJson!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
