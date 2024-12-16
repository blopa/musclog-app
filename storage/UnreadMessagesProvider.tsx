import { UNREAD_MESSAGES_COUNT } from '@/constants/storage';
import useAsyncStorage from '@/hooks/useAsyncStorage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect } from 'react';

interface UnreadMessagesContextValue {
    emptyUnreadMessages: () => void;
    increaseUnreadMessages: (count: number) => void;
    unreadMessages: number;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
    emptyUnreadMessages: () => {},
    increaseUnreadMessages: (count: number) => {},
    unreadMessages: 0,
});

export const useUnreadMessages = () => useContext(UnreadMessagesContext);

interface UnreadMessagesProviderProps {
    children: ReactNode;
}

export const UnreadMessagesProvider: React.FC<UnreadMessagesProviderProps> = ({ children }) => {
    const {
        getValue: getUnreadMessages,
        removeValue: removeUnreadMessages,
        setValue: setUnreadMessages,
        value: unreadMessages,
    } = useAsyncStorage<number>(UNREAD_MESSAGES_COUNT, 0);

    const increaseUnreadMessages = useCallback(async (count: number) => {
        const currentCount = await getUnreadMessages() || 0;
        setUnreadMessages(currentCount + count);
    }, [getUnreadMessages, setUnreadMessages]);

    const emptyUnreadMessages = useCallback(() => {
        setUnreadMessages(0);
    }, [setUnreadMessages]);

    useEffect(() => {
        // @ts-ignore it's fine
        global.increaseUnreadMessages = increaseUnreadMessages;
        // @ts-ignore it's fine
        global.emptyUnreadMessages = emptyUnreadMessages;
    }, [emptyUnreadMessages, increaseUnreadMessages]);

    return (
        <UnreadMessagesContext.Provider
            value={{
                emptyUnreadMessages,
                increaseUnreadMessages,
                unreadMessages,
            }}
        >
            {children}
        </UnreadMessagesContext.Provider>
    );
};
