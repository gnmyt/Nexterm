import { useCallback, useEffect, useRef, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";

export const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", CONNECTIONS: "CONNECTIONS" };

const CONNECTION_TIMEOUT_MS = 3000;

export const useStateStream = (sessionToken, handlers = {}) => {
    const handlersRef = useRef(handlers);
    const [connectionError, setConnectionError] = useState(false);
    const hasConnectedRef = useRef(false);
    
    useEffect(() => { handlersRef.current = handlers; }, [handlers]);

    const wsUrl = sessionToken ? getWebSocketUrl("/api/ws/state", { sessionToken, tabId: getTabId(), browserId: getBrowserId() }) : null;
    
    const onOpen = useCallback(() => {
        hasConnectedRef.current = true;
        setConnectionError(false);
    }, []);
    
    const onClose = useCallback(() => {
        if (!hasConnectedRef.current) {
            setConnectionError(true);
        }
    }, []);
    
    const onError = useCallback(() => {
        if (!hasConnectedRef.current) {
            setConnectionError(true);
        }
    }, []);

    const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: Infinity,
        reconnectInterval: 3000,
        retryOnError: true,
        onOpen,
        onClose,
        onError,
    }, !!sessionToken);

    useEffect(() => {
        if (!sessionToken || hasConnectedRef.current) return;
        
        if (readyState === ReadyState.CONNECTING) {
            const timeout = setTimeout(() => {
                if (!hasConnectedRef.current) {
                    setConnectionError(true);
                }
            }, CONNECTION_TIMEOUT_MS);
            return () => clearTimeout(timeout);
        }
    }, [sessionToken, readyState]);

    useEffect(() => {
        if (!sessionToken) {
            hasConnectedRef.current = false;
            setConnectionError(false);
        }
    }, [sessionToken]);

    useEffect(() => {
        if (!lastMessage?.data) return;
        try {
            const { type, data } = JSON.parse(lastMessage.data);
            if (type && handlersRef.current[type]) handlersRef.current[type](data);
        } catch {}
    }, [lastMessage]);

    const requestRefresh = useCallback((type = null) => {
        if (readyState === ReadyState.OPEN) sendMessage(JSON.stringify({ action: "refresh", type }));
    }, [sendMessage, readyState]);

    return { isConnected: readyState === ReadyState.OPEN, connectionError, requestRefresh };
};
