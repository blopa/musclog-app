import { Q } from '@nozbe/watermelondb';

import { database } from '../database-instance';
import ChatMessage, { type ChatMessageType, type ChatSender } from '../models/ChatMessage';

export class ChatService {
  static generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  static async saveMessage(params: {
    sessionId: string;
    sender: ChatSender;
    message: string;
    messageType?: ChatMessageType;
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
        record.payloadJson = params.payloadJson;
        record.summarizedMessage = params.summarizedMessage;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  static async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    return await database
      .get<ChatMessage>('chat_messages')
      .query(
        Q.where('session_id', sessionId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.asc)
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
