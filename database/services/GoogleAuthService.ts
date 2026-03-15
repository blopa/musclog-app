import { Q } from '@nozbe/watermelondb';

import { GOOGLE_OAUTH_GEMINI_ENABLED_TYPE, GOOGLE_REFRESH_TOKEN_TYPE } from '../../constants/misc';
import { database } from '../database-instance';
import Setting from '../models/Setting';

export class GoogleAuthService {
  /**
   * Get refresh token from WatermelonDB Setting
   */
  static async getRefreshToken(): Promise<string | null> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_REFRESH_TOKEN_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0 || !settings[0].value) {
      return null;
    }

    return settings[0].value;
  }

  /**
   * Save refresh token to WatermelonDB Setting
   */
  static async saveRefreshToken(refreshToken: string): Promise<void> {
    const now = Date.now();
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_REFRESH_TOKEN_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSettings.length > 0) {
        await existingSettings[0].update((setting) => {
          setting.value = refreshToken;
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = GOOGLE_REFRESH_TOKEN_TYPE;
          setting.value = refreshToken;
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Clear refresh token
   */
  static async clearRefreshToken(): Promise<void> {
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_REFRESH_TOKEN_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (existingSettings.length > 0) {
      await database.write(async () => {
        await existingSettings[0].update((setting) => {
          setting.value = '';
          setting.updatedAt = Date.now();
        });
      });
    }
  }

  /**
   * Get OAuth Gemini enabled setting
   */
  static async getOAuthGeminiEnabled(): Promise<boolean> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_OAUTH_GEMINI_ENABLED_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0) {
      return false;
    }

    // Check value for 'true' or value for 1
    return settings[0].value === 'true';
  }

  /**
   * Set OAuth Gemini enabled setting
   */
  static async setOAuthGeminiEnabled(enabled: boolean): Promise<void> {
    const now = Date.now();
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_OAUTH_GEMINI_ENABLED_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSettings.length > 0) {
        await existingSettings[0].update((setting) => {
          setting.value = enabled ? 'true' : 'false';
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = GOOGLE_OAUTH_GEMINI_ENABLED_TYPE;
          setting.value = enabled ? 'true' : 'false';
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }
}
