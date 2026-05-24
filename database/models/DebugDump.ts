import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type DebugDumpDirection = 'request' | 'response';

export default class DebugDump extends Model {
  static table = 'debug_dump';

  @field('provider') declare provider: string;
  @field('direction') declare direction: DebugDumpDirection;
  @field('operation') declare operation: string;
  @field('payload_json') declare payloadJson: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;
}
