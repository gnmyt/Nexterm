import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Backoff schedule (seconds) between reconnect attempts. Length = max attempts.
const BACKOFFS = [5, 10, 30, 60, 120];
const MAX_ATTEMPTS = BACKOFFS.length;

// Cooldown to dedupe near-simultaneous reconnect triggers (e.g. the "online"
// event and the state-stream reconnect edge firing together) so a session is
// not reconnected twice within one async POST window.
const RECONNECT_COOLDOWN_MS = 3000;

// Session types eligible for auto-reconnect: interactive terminal (SSH) and
// RDP/VNC (Guacamole) only. Scripts (would re-run), SFTP (has its own socket
// reconnect), notes and joined/shared sessions are excluded.
const isEligible = (session) => {
    if (!session) return false;
    if (session.type === "notes" || session.isJoined) return false;
    if (session.scriptId) return false;
    if (session.type === "sftp") return false;
    return true;
};

/**
 * Auto-reconnect orchestrator for dropped sessions.
 *
 * State is keyed by the session's stable `reconnectKey` (carried across the
 * session-id change that each reconnect causes) rather than by session id.
 *
 * @param activeSessions  current sessions array (each may carry `reconnectKey`)
 * @param reconnectSession(sessionId)  app-level reconnect (creates a fresh session in place)
 * @param getSessionError(sessionId)   returns the pinned error for a session, or null
 * @param enabled         whether auto-reconnect is turned on (the user preference)
 * @param serverConnected whether the Nexterm server is currently reachable (state-stream isConnected)
 */
export const useAutoReconnect = ({ activeSessions, reconnectSession, getSessionError, enabled, serverConnected }) => {
    // key -> { attempt, maxAttempts, nextAttemptAt }; drives the countdown UI.
    const [reconnectStates, setReconnectStates] = useState({});

    const connectedByKey = useRef(new Map());     // key -> has ever actively connected (eligibility)
    const attemptsByKey = useRef(new Map());      // key -> retries used in the current failure streak
    const timersByKey = useRef(new Map());        // key -> pending setTimeout id
    const lastReconnectByKey = useRef(new Map()); // key -> last reconnect fire timestamp (cooldown)

    // Latest values for use inside stable callbacks / timer bodies. Synced in an
    // effect (not during render); timers and events fire later, so they read the
    // up-to-date values.
    const activeSessionsRef = useRef(activeSessions);
    const enabledRef = useRef(enabled);
    const reconnectSessionRef = useRef(reconnectSession);
    const getSessionErrorRef = useRef(getSessionError);
    useEffect(() => {
        activeSessionsRef.current = activeSessions;
        enabledRef.current = enabled;
        reconnectSessionRef.current = reconnectSession;
        getSessionErrorRef.current = getSessionError;
    });

    const keyForSession = useCallback((sessionId) =>
        activeSessionsRef.current.find(s => s.id === sessionId)?.reconnectKey || null, []);

    const sessionForKey = useCallback((key) =>
        activeSessionsRef.current.find(s => s.reconnectKey === key) || null, []);

    const clearTimer = useCallback((key) => {
        const timer = timersByKey.current.get(key);
        if (timer) {
            clearTimeout(timer);
            timersByKey.current.delete(key);
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

    // Fire a reconnect for a key, deduped by a short cooldown so overlapping
    // triggers don't create duplicate sessions. Returns false if it was
    // suppressed by the cooldown.
    const doReconnect = useCallback((sessionId, key) => {
        const now = Date.now();
        if (now - (lastReconnectByKey.current.get(key) || 0) < RECONNECT_COOLDOWN_MS) return false;
        lastReconnectByKey.current.set(key, now);
        reconnectSessionRef.current?.(sessionId);
        return true;
    }, []);

    const fire = useCallback((key) => {
        timersByKey.current.delete(key);
        attemptsByKey.current.set(key, (attemptsByKey.current.get(key) || 0) + 1);
        // Keep reconnectStates[key] so the failed page shows "Reconnecting…" (0s)
        // until the fresh session mounts and either connects or errors again.
        const session = sessionForKey(key);
        if (session && getSessionErrorRef.current?.(session.id)) {
            doReconnect(session.id, key);
        }
    }, [sessionForKey, doReconnect]);

    const schedule = useCallback((key) => {
        if (timersByKey.current.has(key)) return; // already scheduled
        const attempts = attemptsByKey.current.get(key) || 0;
        if (attempts >= MAX_ATTEMPTS) {
            clearState(key); // give up: fall back to the manual Reconnect button
            return;
        }
        const delay = BACKOFFS[attempts];
        const nextAttemptAt = Date.now() + delay * 1000;
        setReconnectStates(prev => ({ ...prev, [key]: { attempt: attempts + 1, maxAttempts: MAX_ATTEMPTS, nextAttemptAt } }));
        timersByKey.current.set(key, setTimeout(() => fire(key), delay * 1000));
    }, [clearState, fire]);

    // Called by renderers when a session becomes actively connected.
    const markSessionConnected = useCallback((sessionId) => {
        const key = keyForSession(sessionId);
        if (!key) return;
        connectedByKey.current.set(key, true);
        attemptsByKey.current.set(key, 0);
        clearTimer(key);
        clearState(key);
    }, [keyForSession, clearTimer, clearState]);

    // Called when a session errors (via markSessionErrored in Servers.jsx).
    const handleSessionErrored = useCallback((sessionId) => {
        if (!enabledRef.current) return;
        const session = activeSessionsRef.current.find(s => s.id === sessionId);
        if (!isEligible(session) || !session.reconnectKey) return;
        if (!connectedByKey.current.get(session.reconnectKey)) return; // never actively connected
        schedule(session.reconnectKey);
    }, [schedule]);

    // Reconnect immediately (from the "Reconnect now" / manual button), cancelling
    // any pending timer so we don't reconnect twice.
    const reconnectNow = useCallback((sessionId) => {
        const key = keyForSession(sessionId);
        if (key) {
            clearTimer(key);
            clearState(key);
            doReconnect(sessionId, key);
        } else {
            reconnectSessionRef.current?.(sessionId);
        }
    }, [keyForSession, clearTimer, clearState, doReconnect]);

    // The Nexterm server just became reachable (or the browser came online):
    // give every eligible, currently-errored session a fresh retry budget and
    // reconnect it now instead of waiting out the backoff.
    const retryOnReachable = useCallback(() => {
        if (!enabledRef.current) return;
        for (const session of activeSessionsRef.current) {
            const key = session.reconnectKey;
            if (!key || !isEligible(session)) continue;
            if (!connectedByKey.current.get(key)) continue;
            if (!getSessionErrorRef.current?.(session.id)) continue;
            attemptsByKey.current.set(key, 0);
            clearTimer(key);
            clearState(key);
            // If a reconnect just fired (cooldown), fall back to arming a timer
            // so the session still retries rather than getting stuck.
            if (!doReconnect(session.id, key)) schedule(key);
        }
    }, [clearTimer, clearState, doReconnect, schedule]);

    // Fire retryOnReachable on the server-reachable rising edge.
    const prevServerConnectedRef = useRef(serverConnected);
    useEffect(() => {
        const was = prevServerConnectedRef.current;
        prevServerConnectedRef.current = serverConnected;
        if (!was && serverConnected) retryOnReachable();
    }, [serverConnected, retryOnReachable]);

    // Also react to the browser regaining network.
    useEffect(() => {
        window.addEventListener("online", retryOnReachable);
        return () => window.removeEventListener("online", retryOnReachable);
    }, [retryOnReachable]);

    // Cancel everything when the feature is turned off.
    useEffect(() => {
        if (enabled) return;
        timersByKey.current.forEach(timer => clearTimeout(timer));
        timersByKey.current.clear();
        setReconnectStates({});
    }, [enabled]);

    // Prune state for sessions that no longer exist (closed tabs). During a
    // reconnect the key persists (new session carries it), so it is not pruned.
    useEffect(() => {
        const liveKeys = new Set(activeSessions.map(s => s.reconnectKey).filter(Boolean));
        for (const key of Array.from(timersByKey.current.keys())) {
            if (!liveKeys.has(key)) clearTimer(key);
        }
        for (const map of [connectedByKey.current, attemptsByKey.current, lastReconnectByKey.current]) {
            for (const key of Array.from(map.keys())) if (!liveKeys.has(key)) map.delete(key);
        }
        setReconnectStates(prev => {
            let changed = false;
            const next = { ...prev };
            for (const key of Object.keys(prev)) {
                if (!liveKeys.has(key)) {
                    delete next[key];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [activeSessions, clearTimer]);

    // Clear all timers on unmount.
    useEffect(() => () => {
        timersByKey.current.forEach(timer => clearTimeout(timer));
        timersByKey.current.clear();
    }, []);

    return useMemo(() => ({
        reconnectStates,
        markSessionConnected,
        handleSessionErrored,
        reconnectNow,
    }), [reconnectStates, markSessionConnected, handleSessionErrored, reconnectNow]);
};
