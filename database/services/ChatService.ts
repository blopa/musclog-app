import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import ChatMessage, {
  type ChatMessageContext,
  type ChatMessageType,
  type ChatSender,
} from '@/database/models/ChatMessage';

export class ChatService {
  static async saveMessage(params: {
    sender: ChatSender;
    message: string;
    context: ChatMessageContext;
    messageType?: ChatMessageType;
    payloadJson?: string;
    summarizedMessage?: string;
  }): Promise<ChatMessage> {
    const now = Date.now();
    return await database.write(async () => {
      return await database.get<ChatMessage>('chat_messages').create((record) => {
        record.sender = params.sender;
        record.message = params.message;
        record.messageType = params.messageType ?? 'text';
        record.context = params.context;
        record.payloadJson = params.payloadJson;
        record.summarizedMessage = params.summarizedMessage;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  /**
   * Fetch messages for a context, newest-first (DESC), with optional pagination.
   * @param context The conversation context ('general' | 'exercise' | 'nutrition')
   * @param limit  How many messages to return
   * @param offset How many messages to skip (for load-more of older messages)
   */
  static async getMessagesByContext(
    context: ChatMessageContext,
    limit?: number,
    offset?: number
  ): Promise<ChatMessage[]> {
    let query = database
      .get<ChatMessage>('chat_messages')
      .query(
        Q.where('context', context),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      );

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

  static async updateMessagePayload(messageId: string, payloadJson: string): Promise<void> {
    const record = await database.get<ChatMessage>('chat_messages').find(messageId);
    await database.write(async () => {
      await record.update((r) => {
        r.payloadJson = payloadJson;
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

  /**
   * Soft-delete all messages for a specific conversation context.
   * @param context The conversation context to delete ('general' | 'exercise' | 'nutrition')
   */
  static async deleteMessagesByContext(context: ChatMessageContext): Promise<void> {
    const messages = await database
      .get<ChatMessage>('chat_messages')
      .query(Q.where('context', context), Q.where('deleted_at', Q.eq(null)))
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
