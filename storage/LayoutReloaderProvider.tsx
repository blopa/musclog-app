import React, { createContext, ReactNode, useContext, useState } from 'react';

interface LayoutReloaderContextValue {
    reloadKey: number;
    setReloadKey: (date: number) => void;
}

const LayoutReloaderContext = createContext<LayoutReloaderContextValue>({
    reloadKey: 0,
    setReloadKey: (date: number) => {},
});

export const useLayoutReloader = () => useContext(LayoutReloaderContext);

interface LayoutReloaderProviderProps {
    children: ReactNode;
}

export const LayoutReloaderProvider = ({ children }: LayoutReloaderProviderProps) => {
    const [reloadKey, setReloadKey] = useState(0);

    return (
        <LayoutReloaderContext.Provider value={{ reloadKey, setReloadKey }}>
            {children}
        </LayoutReloaderContext.Provider>
    );
};
