import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

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
    const [unreadMessages, setUnreadMessages] = useState(0);

    const increaseUnreadMessages = useCallback((count: number) => {
        setUnreadMessages((prev) => prev + count);
    }, []);

    const emptyUnreadMessages = useCallback(() => {
        setUnreadMessages(0);
    }, []);

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
