import { createContext } from "react";

export const ServerContext = createContext({  });

export const ServerProvider = ({ children }) => {
    return (
        <ServerContext.Provider value={{  }}>
            {children}
        </ServerContext.Provider>
    )
}