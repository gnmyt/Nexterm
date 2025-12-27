import { createContext, useContext, useCallback, useMemo, useRef, useEffect } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useStateStream, STATE_TYPES } from "@/common/hooks/useStateStream.js";

export const StateStreamContext = createContext({});
export { STATE_TYPES };

const allTypes = Object.values(STATE_TYPES);

export const StateStreamProvider = ({ children }) => {
    const { sessionToken } = useContext(UserContext);
    const handlersRef = useRef(Object.fromEntries(allTypes.map(type => [type, new Set()])));
    const stateBufferRef = useRef(Object.fromEntries(allTypes.map(type => [type, null])));

    const stateHandlers = useMemo(() => Object.fromEntries(allTypes.map(type => [type, (data) => {
        stateBufferRef.current[type] = data;
        handlersRef.current[type].forEach(handler => handler(data));
    }])), []);

    const { isConnected, requestRefresh } = useStateStream(sessionToken, stateHandlers);

    useEffect(() => {
        if (!sessionToken) stateBufferRef.current = Object.fromEntries(allTypes.map(type => [type, null]));
    }, [sessionToken]);

    const registerHandler = useCallback((stateType, handler) => {
        if (!handlersRef.current[stateType]) return () => {};
        handlersRef.current[stateType].add(handler);
        if (stateBufferRef.current[stateType] !== null) handler(stateBufferRef.current[stateType]);
        return () => handlersRef.current[stateType].delete(handler);
    }, []);

    const contextValue = useMemo(() => ({ isConnected, registerHandler, requestRefresh }), [isConnected, registerHandler, requestRefresh]);
    return <StateStreamContext.Provider value={contextValue}>{children}</StateStreamContext.Provider>;
};
