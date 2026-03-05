import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type ChatSender = 'user' | 'coach';
export type ChatMessageType = 'text';

export default class ChatMessage extends Model {
  static table = 'chat_messages';

  @field('session_id') sessionId!: string;
  @field('sender') sender!: ChatSender;
  @field('message') message!: string;
  @field('message_type') messageType!: ChatMessageType;
  @field('payload_json') payloadJson?: string;
  @field('summarized_message') summarizedMessage?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
