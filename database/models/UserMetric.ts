import { Model, Q } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';
import { Unit } from 'convert';

import { decryptNumber, decryptOptionalString } from '../encryptionHelpers';
import UserMetricsNote from './UserMetricsNote';

export interface DecryptedUserMetricFields {
  value: number;
  unit?: string;
  date: number;
}

export type UserMetricType =
  | 'weight'
  | 'body_fat'
  | 'muscle_mass'
  | 'lean_body_mass'
  | 'basal_metabolic_rate'
  | 'total_calories_burned'
  | 'active_calories_burned'
  | 'bmi'
  | 'height'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'arms'
  | 'thighs'
  | 'calves'
  | 'neck'
  | 'shoulders'
  | 'mood'
  | 'supplement'
  | 'ffmi'
  | 'nutrition'
  | 'exercise'
  | 'period_flow'
  | 'period_symptoms'
  | 'basal_body_temp'
  | 'other';

export default class UserMetric extends Model {
  static table = 'user_metrics';

  @field('type') type!: UserMetricType;
  @field('external_id') externalId?: string;
  @field('supplement_id') supplementId?: string;
  @field('value') valueRaw!: string;
  @field('unit') unitRaw?: string;
  @field('date') date!: number;
  @field('timezone') timezone!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  // Relation to notes
  @children('user_metrics_notes') notes!: any[];

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  /** Decrypt value and unit. Date is stored plain. Use for display and calculations. */
  async getDecrypted(): Promise<DecryptedUserMetricFields> {
    const [value, unit] = await Promise.all([
      decryptNumber(this.valueRaw),
      decryptOptionalString(this.unitRaw),
    ]);

    return { value, unit: (unit as Unit) || undefined, date: this.date };
  }

  /** Get the note for this metric from the notes table */
  async getNote(): Promise<string | undefined> {
    const notesCollection = this.database.get<UserMetricsNote>('user_metrics_notes');
    const notes = await notesCollection
      .query(Q.where('user_metric_id', this.id), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return notes[0]?.note;
  }

  /** Add or update a note for this metric. Requires a write transaction. */
  async setNote(noteText: string): Promise<void> {
    const database = this.database;
    const now = Date.now();

    const notesCollection = database.get<UserMetricsNote>('user_metrics_notes');

    // First, mark any existing notes as deleted
    const existingNotes = await notesCollection
      .query(Q.where('user_metric_id', this.id), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    for (const existingNote of existingNotes) {
      await existingNote.update((record) => {
        record.deletedAt = now;
        record.updatedAt = now;
      });
    }

    // Create new note if text is provided
    if (noteText.trim()) {
      await notesCollection.create((note) => {
        note.userMetricId = this.id;
        note.note = noteText.trim();
        note.createdAt = now;
        note.updatedAt = now;
      });
    }
  }
}
