import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldAttemptAutoReconnect } from "@/common/utils/ReconnectPolicy.js";

const BACKOFFS = [5, 10, 30, 60, 120];
const MAX_ATTEMPTS = BACKOFFS.length;
const RECONNECT_COOLDOWN_MS = 3000;
const STABLE_CONNECTION_MS = 10000;

export const useAutoReconnect = ({ activeSessions, reconnectSession, getSessionErrorInfo, enabled, serverConnected }) => {
    const [reconnectStates, setReconnectStates] = useState({});

    const connectedByKey = useRef(new Map());
    const attemptsByKey = useRef(new Map());
    const timersByKey = useRef(new Map());
    const lastReconnectByKey = useRef(new Map());
    const reconnectsByKey = useRef(new Map());
    const connectionTimersByKey = useRef(new Map());
    const scheduleRef = useRef(null);

    const activeSessionsRef = useRef(activeSessions);
    const enabledRef = useRef(enabled);
    const reconnectSessionRef = useRef(reconnectSession);
    const getSessionErrorInfoRef = useRef(getSessionErrorInfo);
    useEffect(() => {
        activeSessionsRef.current = activeSessions;
        enabledRef.current = enabled;
        reconnectSessionRef.current = reconnectSession;
        getSessionErrorInfoRef.current = getSessionErrorInfo;
    });

    const keyForSession = useCallback((sessionId) =>
        activeSessionsRef.current.find(s => s.id === sessionId)?.reconnectKey || null, []);

    const sessionForKey = useCallback((key) =>
        activeSessionsRef.current.find(s => s.reconnectKey === key) || null, []);

    const clearTimer = useCallback((key) => {
        const timer = timersByKey.current.get(key);
        if (timer !== undefined) {
            clearTimeout(timer);
            timersByKey.current.delete(key);
        }
    }, []);

    const clearConnectionTimer = useCallback((key) => {
        const timer = connectionTimersByKey.current.get(key);
        if (timer !== undefined) {
            clearTimeout(timer);
            connectionTimersByKey.current.delete(key);
        }
    }, []);

    const clearState = useCallback((key) => {
        setReconnectStates(prev => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const doReconnect = useCallback((sessionId, key, { bypassCooldown = false } = {}) => {
        const reconnecting = reconnectsByKey.current.get(key);
        if (reconnecting) return reconnecting;
        const now = Date.now();
        if (!bypassCooldown && now - (lastReconnectByKey.current.get(key) || 0) < RECONNECT_COOLDOWN_MS) return Promise.resolve(null);
        lastReconnectByKey.current.set(key, now);
        const reconnect = Promise.resolve(reconnectSessionRef.current?.(sessionId))
            .then(result => result?.deferred ? null : result?.connected === true)
            .catch(() => false)
            .finally(() => reconnectsByKey.current.delete(key));
        reconnectsByKey.current.set(key, reconnect);
        return reconnect;
    }, []);

    const schedule = useCallback((key) => {
        if (timersByKey.current.has(key)) return;
        const session = sessionForKey(key);
        const errorInfo = session ? getSessionErrorInfoRef.current?.(session.id) : null;
        if (!shouldAttemptAutoReconnect({
            enabled: enabledRef.current,
            session,
            errorInfo,
            wasConnected: connectedByKey.current.get(key),
        })) {
            clearState(key);
            return;
        }
        const attempts = attemptsByKey.current.get(key) || 0;
        if (attempts >= MAX_ATTEMPTS) {
            clearState(key);
            return;
        }
        const delay = BACKOFFS[attempts];
        const nextAttemptAt = Date.now() + delay * 1000;
        setReconnectStates(prev => ({ ...prev, [key]: { attempt: attempts + 1, maxAttempts: MAX_ATTEMPTS, nextAttemptAt } }));
        timersByKey.current.set(key, setTimeout(async () => {
            timersByKey.current.delete(key);
            attemptsByKey.current.set(key, (attemptsByKey.current.get(key) || 0) + 1);
            const session = sessionForKey(key);
            const errorInfo = session ? getSessionErrorInfoRef.current?.(session.id) : null;
            if (!shouldAttemptAutoReconnect({
                enabled: enabledRef.current,
                session,
                errorInfo,
                wasConnected: connectedByKey.current.get(key),
            })) {
                clearState(key);
                return;
            }
            const reconnected = await doReconnect(session.id, key);
            if (reconnected === false) scheduleRef.current?.(key);
        }, delay * 1000));
    }, [clearState, doReconnect, sessionForKey]);

    useEffect(() => {
        scheduleRef.current = schedule;
    }, [schedule]);
    const markSessionConnected = useCallback((sessionId) => {
        const key = keyForSession(sessionId);
        if (!key) return;
        connectedByKey.current.set(key, true);
        clearTimer(key);
        clearState(key);
        clearConnectionTimer(key);
        connectionTimersByKey.current.set(key, setTimeout(() => {
            attemptsByKey.current.set(key, 0);
            connectionTimersByKey.current.delete(key);
        }, STABLE_CONNECTION_MS));
    }, [keyForSession, clearTimer, clearState, clearConnectionTimer]);

    const handleSessionErrored = useCallback((sessionId) => {
        const session = activeSessionsRef.current.find(s => s.id === sessionId);
        const key = session?.reconnectKey;
        if (!key || !shouldAttemptAutoReconnect({
            enabled: enabledRef.current,
            session,
            errorInfo: getSessionErrorInfoRef.current?.(sessionId),
            wasConnected: connectedByKey.current.get(key),
        })) return;
        clearConnectionTimer(key);
        schedule(key);
    }, [schedule, clearConnectionTimer]);

    const reconnectNow = useCallback((sessionId) => {
        const key = keyForSession(sessionId);
        if (key) {
            clearTimer(key);
            clearState(key);
            attemptsByKey.current.set(key, 0);
            return doReconnect(sessionId, key, { bypassCooldown: true });
        }
        return Promise.resolve(reconnectSessionRef.current?.(sessionId));
    }, [keyForSession, clearTimer, clearState, doReconnect]);

    const retryOnReachable = useCallback(() => {
        for (const session of activeSessionsRef.current) {
            const key = session.reconnectKey;
            if (!key || !shouldAttemptAutoReconnect({
                enabled: enabledRef.current,
                session,
                errorInfo: getSessionErrorInfoRef.current?.(session.id),
                wasConnected: connectedByKey.current.get(key),
            })) continue;
            if (Date.now() - (lastReconnectByKey.current.get(key) || 0) < RECONNECT_COOLDOWN_MS) {
                continue;
            }
            clearTimer(key);
            clearState(key);
            void doReconnect(session.id, key).then((reconnected) => {
                if (reconnected === false) schedule(key);
            });
        }
    }, [clearTimer, clearState, doReconnect, schedule]);

    const prevServerConnectedRef = useRef(serverConnected);
    useEffect(() => {
        const was = prevServerConnectedRef.current;
        prevServerConnectedRef.current = serverConnected;
        if (!was && serverConnected) retryOnReachable();
    }, [serverConnected, retryOnReachable]);

    useEffect(() => {
        window.addEventListener("online", retryOnReachable);
        return () => window.removeEventListener("online", retryOnReachable);
    }, [retryOnReachable]);

    useEffect(() => {
        if (enabled) return;
        timersByKey.current.forEach(timer => clearTimeout(timer));
        timersByKey.current.clear();
        connectionTimersByKey.current.forEach(timer => clearTimeout(timer));
        connectionTimersByKey.current.clear();
        queueMicrotask(() => setReconnectStates({}));
    }, [enabled]);

    useEffect(() => {
        const liveKeys = new Set(activeSessions.map(s => s.reconnectKey).filter(Boolean));
        for (const key of Array.from(timersByKey.current.keys())) {
            if (!liveKeys.has(key)) clearTimer(key);
        }
        for (const key of Array.from(connectionTimersByKey.current.keys())) {
            if (!liveKeys.has(key)) clearConnectionTimer(key);
        }
        for (const map of [connectedByKey.current, attemptsByKey.current, lastReconnectByKey.current, reconnectsByKey.current]) {
            for (const key of Array.from(map.keys())) if (!liveKeys.has(key)) map.delete(key);
        }
        queueMicrotask(() => setReconnectStates(prev => {
            let changed = false;
            const next = { ...prev };
            for (const key of Object.keys(prev)) {
                if (!liveKeys.has(key)) {
                    delete next[key];
                    changed = true;
                }
            }
            return changed ? next : prev;
        }));
    }, [activeSessions, clearTimer, clearConnectionTimer]);

    useEffect(() => () => {
        timersByKey.current.forEach(timer => clearTimeout(timer));
        timersByKey.current.clear();
        connectionTimersByKey.current.forEach(timer => clearTimeout(timer));
        connectionTimersByKey.current.clear();
    }, []);

    return useMemo(() => ({
        reconnectStates,
        markSessionConnected,
        handleSessionErrored,
        reconnectNow,
    }), [reconnectStates, markSessionConnected, handleSessionErrored, reconnectNow]);
};
