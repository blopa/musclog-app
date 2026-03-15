import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import type { TrackedMeal, TrackMealIngredient } from '../../utils/coachAI';

export type ChatSender = 'user' | 'coach';
export type ChatMessageType = 'text';
export type ChatMessageContext = 'nutrition' | 'exercise' | 'general';

/**
 * TypeScript schema for payload_json field in chat_messages table
 *
 * This field stores structured JSON data for different message types.
 * All payloads must have a 'type' field to discriminate between variants.
 */

// Image payload - when user sends an image message
export type ImagePayload = {
  type: 'image';
  image: string; // Base64 encoded image string (may or may not include data: prefix)
};

// Workout completed payload - when a workout is finished
export type WorkoutCompletedPayload = {
  type: 'workoutCompleted';
  workoutLogId: string;
  workoutName: string;
  volume: string; // Formatted volume string (e.g., "500 kg")
  duration: string; // Formatted duration string (e.g., "45m" or "1h 30m")
  personalRecords: number; // Count of personal records achieved
  weightUnit: string; // Weight unit used (e.g., "kg" or "lbs")
};

// Workout plan payload - when AI generates a workout plan
export type WorkoutPlanPayload = {
  type: 'workoutPlan';
  templateIds: string[]; // Array of workout template IDs created
  count: number; // Number of workout templates generated
};

// Track meal payload - when AI analyzes and tracks a meal
export type TrackMealPayload = {
  type: 'trackMeal';
  meals: (TrackedMeal & { was_tracked?: boolean })[]; // Array of meals analyzed (can be multiple meals from one message)
};

// Union type representing all possible payload_json values
export type ChatMessagePayload =
  | ImagePayload
  | WorkoutCompletedPayload
  | WorkoutPlanPayload
  | TrackMealPayload;

// Helper type guard functions for type narrowing
export function isImagePayload(payload: ChatMessagePayload): payload is ImagePayload {
  return payload.type === 'image';
}

export function isWorkoutCompletedPayload(
  payload: ChatMessagePayload
): payload is WorkoutCompletedPayload {
  return payload.type === 'workoutCompleted';
}

export function isWorkoutPlanPayload(payload: ChatMessagePayload): payload is WorkoutPlanPayload {
  return payload.type === 'workoutPlan';
}

export function isTrackMealPayload(payload: ChatMessagePayload): payload is TrackMealPayload {
  return payload.type === 'trackMeal';
}

export default class ChatMessage extends Model {
  static table = 'chat_messages';

  static associations = {
    // No relationships defined for chat messages currently
  };

  @field('session_id') sessionId!: string;
  @field('sender') sender!: ChatSender;
  @field('message') message!: string;
  @field('message_type') messageType!: ChatMessageType;
  @field('context') context!: ChatMessageContext;
  @field('payload_json') payloadJson?: string;
  @field('summarized_message') summarizedMessage?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
