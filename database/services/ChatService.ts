import { Q } from '@nozbe/watermelondb';

import { database } from '../database-instance';
import ChatMessage, {
  type ChatMessageContext,
  type ChatMessageType,
  type ChatSender,
} from '../models/ChatMessage';

export class ChatService {
  static generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  static async saveMessage(params: {
    sessionId: string;
    sender: ChatSender;
    message: string;
    messageType?: ChatMessageType;
    context?: ChatMessageContext;
    payloadJson?: string;
    summarizedMessage?: string;
  }): Promise<ChatMessage> {
    const now = Date.now();
    return await database.write(async () => {
      return await database.get<ChatMessage>('chat_messages').create((record) => {
        record.sessionId = params.sessionId;
        record.sender = params.sender;
        record.message = params.message;
        record.messageType = params.messageType ?? 'text';
        record.context = params.context ?? 'general';
        record.payloadJson = params.payloadJson;
        record.summarizedMessage = params.summarizedMessage;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  /**
   * Fetch messages for a session, newest-first (DESC), with optional pagination.
   * @param sessionId
   * @param limit  How many messages to return
   * @param offset How many messages to skip (for load-more of older messages)
   * @param context Optional context filter ('general' | 'exercise' | 'nutrition')
   */
  static async getSessionMessages(
    sessionId: string,
    limit?: number,
    offset?: number,
    context?: ChatMessageContext
  ): Promise<ChatMessage[]> {
    let query = database
      .get<ChatMessage>('chat_messages')
      .query(
        Q.where('session_id', sessionId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      );

    if (context) {
      query = query.extend(Q.where('context', context));
    }

    if (limit !== undefined) {
      if (offset && offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  static async updateMessageSummary(record: ChatMessage, summarizedMessage: string): Promise<void> {
    await database.write(async () => {
      await record.update((r) => {
        r.summarizedMessage = summarizedMessage;
        r.updatedAt = Date.now();
      });
    });
  }

  static async updateMessage(recordId: string, message: string): Promise<void> {
    const record = await database.get<ChatMessage>('chat_messages').find(recordId);
    await database.write(async () => {
      await record.update((r) => {
        r.message = message;
        r.updatedAt = Date.now();
      });
    });
  }

  static async deleteMessage(recordId: string): Promise<void> {
    const record = await database.get<ChatMessage>('chat_messages').find(recordId);
    await database.write(async () => {
      await record.update((r) => {
        r.deletedAt = Date.now();
        r.updatedAt = Date.now();
      });
    });
  }

  static async getAllMessages(limit: number, offset: number): Promise<ChatMessage[]> {
    return await database
      .get<ChatMessage>('chat_messages')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc),
        Q.skip(offset),
        Q.take(limit)
      )
      .fetch();
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const messages = await database
      .get<ChatMessage>('chat_messages')
      .query(Q.where('session_id', sessionId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      const now = Date.now();
      await Promise.all(
        messages.map((msg) =>
          msg.update((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        )
      );
    });
  }
}
