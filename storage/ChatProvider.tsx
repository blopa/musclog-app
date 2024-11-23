import { addChat, deleteChatById, getChatsPaginated } from '@/utils/database';
import { ChatInsertType, ChatReturnType } from '@/utils/types';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface ChatContextValue {
    addNewChat: (chat: ChatInsertType) => Promise<void>;
    chats: ChatReturnType[];
    deleteChat: (id: number) => Promise<void>;
    fetchInitialChats: () => Promise<void>;
    fetchMoreChats: () => Promise<void>;
    hasMore: boolean;
    isLoading: boolean;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const useChatData = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChatData must be used within a ChatProvider');
    }

    return context;
};

interface ChatProviderProps {
    children: ReactNode;
    initialPageSize?: number;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, initialPageSize = 20 }) => {
    const [chats, setChats] = useState<ChatReturnType[]>([]);
    const [loadedChatIds, setLoadedChatIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchInitialChats = useCallback(async () => {
        setIsLoading(true);
        try {
            const newChats = await getChatsPaginated(0, initialPageSize);
            if (newChats.length < initialPageSize) {
                setHasMore(false);
            }

            const newChatIds = new Set(newChats.map((chat) => chat.id!.toString()));
            setLoadedChatIds(newChatIds);
            setChats(newChats);
        } catch (error) {
            console.error('Failed to load chats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [initialPageSize]);

    const fetchMoreChats = useCallback(async () => {
        if (isLoading || !hasMore) {
            return;
        }

        setIsLoading(true);
        try {
            const newChats = await getChatsPaginated(page, initialPageSize);
            const filteredChats = newChats.filter((chat) => !loadedChatIds.has(chat.id!.toString()));
            if (filteredChats.length < initialPageSize) {
                setHasMore(false);
            }

            setLoadedChatIds((prevIds) => {
                const updatedIds = new Set(prevIds);
                filteredChats.forEach((chat) => updatedIds.add(chat.id!.toString()));

                return updatedIds;
            });

            setChats((prevChats) => [...prevChats, ...filteredChats]);
            setPage((prevPage) => prevPage + 1);
        } catch (error) {
            console.error('Failed to load chats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [hasMore, initialPageSize, isLoading, page, loadedChatIds]);

    const addNewChat = async (chat: ChatInsertType) => {
        setIsLoading(true);

        try {
            await addChat(chat);
            await fetchInitialChats();
        } catch (error) {
            console.error('Failed to add chat:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteChat = useCallback(async (id: number) => {
        setIsLoading(true);
        try {
            await deleteChatById(id);
            setChats((prevChats) => prevChats.filter((chat) => chat.id !== id));
            setLoadedChatIds((prevIds) => {
                const updatedIds = new Set(prevIds);
                updatedIds.delete(String(id));
                return updatedIds;
            });
        } catch (error) {
            console.error('Failed to delete chat:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialChats();
    }, [fetchInitialChats]);

    return (
        <ChatContext.Provider
            value={{
                addNewChat,
                chats,
                deleteChat,
                fetchInitialChats,
                fetchMoreChats,
                hasMore,
                isLoading,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
