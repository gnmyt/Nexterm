import { useCallback, useEffect, useRef, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";

export const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", CONNECTIONS: "CONNECTIONS", LOGOUT: "LOGOUT" };

const popoutChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexterm_popout") : null;

const forceLogoutClient = () => {
    popoutChannel?.postMessage({ type: "force_close" });
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("overrideToken");
    window.location.reload();
};

export const useStateStream = (sessionToken, handlers = {}) => {
    const handlersRef = useRef(handlers);
    const [connectionError, setConnectionError] = useState(false);
    const hasConnectedRef = useRef(false);
    const invalidatedRef = useRef(false);
    
    useEffect(() => { handlersRef.current = handlers; }, [handlers]);

    const wsUrl = sessionToken ? getWebSocketUrl("/api/ws/state", { sessionToken, tabId: getTabId(), browserId: getBrowserId() }) : null;
    
    const onOpen = useCallback(() => {
        hasConnectedRef.current = true;
        setConnectionError(false);
    }, []);
    
    const onClose = useCallback((e) => {
        if (e.code === 4010 && hasConnectedRef.current) {
            invalidatedRef.current = true;
            forceLogoutClient();
            return;
        }
        if (!hasConnectedRef.current) setConnectionError(true);
    }, []);
    
    const onError = useCallback(() => {
        if (!hasConnectedRef.current) setConnectionError(true);
    }, []);

    const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: (e) => !invalidatedRef.current && e.code !== 4010,
        reconnectAttempts: Infinity,
        reconnectInterval: 3000,
        retryOnError: true,
        onOpen,
        onClose,
        onError,
    }, !!sessionToken);

    useEffect(() => {
        if (!sessionToken || hasConnectedRef.current || readyState !== ReadyState.CONNECTING) return;
        const timeout = setTimeout(() => { if (!hasConnectedRef.current) setConnectionError(true); }, 5000);
        return () => clearTimeout(timeout);
    }, [sessionToken, readyState]);

    useEffect(() => {
        if (!sessionToken) {
            hasConnectedRef.current = false;
            invalidatedRef.current = false;
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
