import { useCallback, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";

export const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", CONNECTIONS: "CONNECTIONS" };

export const useStateStream = (sessionToken, handlers = {}) => {
    const handlersRef = useRef(handlers);
    useEffect(() => { handlersRef.current = handlers; }, [handlers]);

    const wsUrl = sessionToken ? getWebSocketUrl("/api/ws/state", { sessionToken, tabId: getTabId(), browserId: getBrowserId() }) : null;
    const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: Infinity,
        reconnectInterval: 3000,
        retryOnError: true,
    }, !!sessionToken);

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

    return { isConnected: readyState === ReadyState.OPEN, requestRefresh };
};
