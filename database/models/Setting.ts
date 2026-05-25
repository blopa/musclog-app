import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type SettingType =
  | 'theme'
  | 'unit_system'
  | 'language'
  | 'notifications_enabled'
  | 'workout_reminder'
  | 'rest_timer_enabled'
  | 'default_rest_time'
  | 'weight_unit'
  | 'distance_unit'
  | 'data_sync_enabled'
  | 'sync_wifi_only'
  | 'health_connect_sync_enabled'
  | 'health_connect_last_sync'
  | 'health_connect_sync_in_progress'
  | 'use_ocr_before_ai'
  | 'use_on_device_ai'
  | 'use_musclog_free_tier'
  | 'musclog_gateway_anonymous_id'
  | 'dump_llm_requests'
  | 'ble_generate_chart_payload'
  | 'chart_tooltip_position'
  | 'nutrition_display'
  | 'other';

export default class Setting extends Model {
  static table = 'settings';

  @field('type') declare type: SettingType;
  @field('value') declare value: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;
}
