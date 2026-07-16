import { useEffect, useRef, useState, useContext } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { useTranslation } from "react-i18next";
import ConnectionLoader from "./components/ConnectionLoader";
import ConnectionError, { mapConnectionError } from "./components/ConnectionError";
import SessionToolbar from "./components/SessionToolbar";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import { openPopout, onPopoutClosed } from "@/common/utils/PopoutUtil.js";

const SIZE_RESEND_INTERVAL = 5000;

const SHORTCUT_HOLD = 50;

const ZOOM_MIN = 1;

const ZOOM_MAX = 4;

const ZOOM_STEP = 0.25;

const resumeAudioContext = () => {
    const context = Guacamole.AudioContextFactory.getAudioContext();
    if (context && context.state === "suspended") {
        context.resume();
    }
};

const GuacamoleRenderer = ({
                               session,
                               disconnectFromServer,
                               markSessionErrored,
                               getSessionError,
                               registerGuacamoleRef,
                               onFullscreenToggle,
                               isShared = false,
                               pinnedMonitor = null,
                           }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });

    const ownsSession = !isShared && pinnedMonitor === null;
    const initialMonitor = pinnedMonitor ?? 0;

    const [ready, setReady] = useState(false);

    const [monitorCount, setMonitorCount] = useState(1);
    const [activeMonitor, setActiveMonitor] = useState(initialMonitor);
    const [maxMonitors, setMaxMonitors] = useState(1);

    const [poppedOutMonitors, setPoppedOutMonitors] = useState(() => new Set());
    const poppedOutMonitorsRef = useRef(poppedOutMonitors);

    const [heldModifiers, setHeldModifiers] = useState(() => new Set());
    const heldModifiersRef = useRef(heldModifiers);
    const draggingRef = useRef(false);

    const [zoom, setZoom] = useState(ZOOM_MIN);
    const zoomRef = useRef(ZOOM_MIN);
    const panRef = useRef({ x: 0, y: 0 });
    const panDragRef = useRef(null);

    const monitorCountRef = useRef(1);
    const activeMonitorRef = useRef(initialMonitor);
    const maxMonitorsRef = useRef(1);
    const layoutRef = useRef(null);
    const lastSentRef = useRef({ w: 0, h: 0, monitor: -1, at: 0 });
    const { getParsedKeybind } = useKeymaps();
    const { t } = useTranslation();
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const sessionRef = useRef(session);
    const connectionLoaderRef = useRef(null);
    const audioPlayersRef = useRef([]);
    const errorMessageRef = useRef(null);
    const [connectionError, setConnectionError] = useState(() => getSessionError?.(session.id) || null);
    const errorShownRef = useRef(!!connectionError);

    const reportError = (rawMessage) => {
        if (errorShownRef.current) return;
        errorShownRef.current = true;
        const mapped = mapConnectionError(rawMessage, t);
        markSessionErrored?.(session.id, mapped);
        setConnectionError(mapped);
    };

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);
    useEffect(() => {
        onFullscreenToggleRef.current = onFullscreenToggle;
    }, [onFullscreenToggle]);

    useEffect(() => {
        if (registerGuacamoleRef && clientRef.current) registerGuacamoleRef(session.id, { client: clientRef.current });
        return () => registerGuacamoleRef?.(session.id, null);
    }, [session.id, registerGuacamoleRef, clientRef.current]);

    const applyDisplayStyles = (el, x, y, scale, width, height) => Object.assign(el.style, {
        position: "absolute", width: width + "px", height: height + "px",
        transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: "0 0",
        imageRendering: "crisp-edges", backfaceVisibility: "hidden", willChange: "transform",
    });

    const clampPan = (pan, visible, scaled) => {
        const limit = Math.max((scaled - visible) / 2, 0);
        return Math.min(Math.max(pan, -limit), limit);
    };

    const applyViewport = () => {
        if (!clientRef.current || !ref.current) return;
        const display = clientRef.current.getDisplay();
        const el = display.getElement();
        const [cw, ch] = [ref.current.clientWidth, ref.current.clientHeight];
        if (!cw || !ch) return;

        const layout = layoutRef.current;
        const monitor = layout?.length > 1
            ? layout[Math.min(activeMonitorRef.current, layout.length - 1)]
            : null;

        const [mx, my] = [monitor?.left || 0, monitor?.top || 0];
        const mw = monitor?.width || display.getWidth();
        const mh = monitor?.height || display.getHeight();
        if (!mw || !mh) return;

        const scale = Math.min(cw / mw, ch / mh) * zoomRef.current;
        scaleRef.current = scale;

        panRef.current = {
            x: clampPan(panRef.current.x, cw, mw * scale),
            y: clampPan(panRef.current.y, ch, mh * scale),
        };

        offsetRef.current = {
            x: (cw - mw * scale) / 2 - mx * scale + panRef.current.x,
            y: (ch - mh * scale) / 2 - my * scale + panRef.current.y,
        };

        applyDisplayStyles(el, offsetRef.current.x, offsetRef.current.y, scale,
            display.getWidth(), display.getHeight());
    };

    const applyZoom = (level) => {
        const next = Math.min(Math.max(level, ZOOM_MIN), ZOOM_MAX);
        if (next === zoomRef.current) return;

        if (next === ZOOM_MIN) panRef.current = { x: 0, y: 0 };

        zoomRef.current = next;
        setZoom(next);
        applyViewport();
    };

    const zoomIn = () => applyZoom(zoomRef.current + ZOOM_STEP);

    const zoomOut = () => applyZoom(zoomRef.current - ZOOM_STEP);

    const resetZoom = () => applyZoom(ZOOM_MIN);

    const resizeHandler = () => {
        if (!clientRef.current || !ref.current) return;
        const [cw, ch] = [ref.current.clientWidth, ref.current.clientHeight];

        if (cw > 0 && ch > 0) {
            const monitor = activeMonitorRef.current;
            const last = lastSentRef.current;
            const changed = last.w !== cw || last.h !== ch || last.monitor !== monitor;

            if (changed || Date.now() - last.at >= SIZE_RESEND_INTERVAL) {
                clientRef.current.sendSize(cw, ch, monitor, 0);
                lastSentRef.current = { w: cw, h: ch, monitor, at: Date.now() };
            }
        }

        applyViewport();
    };

    const toggleModifier = (keysym) => {
        if (!clientRef.current) return;
        const held = new Set(heldModifiersRef.current);

        if (held.has(keysym)) {
            clientRef.current.sendKeyEvent(0, keysym);
            held.delete(keysym);
        } else {
            clientRef.current.sendKeyEvent(1, keysym);
            held.add(keysym);
        }

        heldModifiersRef.current = held;
        setHeldModifiers(held);
    };

    const releaseModifiers = () => {
        if (!heldModifiersRef.current.size) return;
        heldModifiersRef.current.forEach((keysym) => clientRef.current?.sendKeyEvent(0, keysym));
        heldModifiersRef.current = new Set();
        setHeldModifiers(new Set());
    };

    const sendShortcut = (keys) => {
        if (!clientRef.current) return;
        keys.forEach((key) => clientRef.current.sendKeyEvent(1, key));
        setTimeout(() => {
            [...keys].reverse().forEach((key) => clientRef.current?.sendKeyEvent(0, key));
        }, SHORTCUT_HOLD);
    };

    const selectMonitor = (index) => {
        activeMonitorRef.current = index;
        setActiveMonitor(index);

        panRef.current = { x: 0, y: 0 };
        applyViewport();
    };

    const addMonitor = () => {
        if (isShared || !clientRef.current) return;
        const count = monitorCountRef.current;
        if (count >= maxMonitorsRef.current) return;

        monitorCountRef.current = count + 1;
        setMonitorCount(count + 1);
        selectMonitor(count);
        resizeHandler();
    };

    const removeMonitor = () => {
        if (isShared || !clientRef.current) return;
        const count = monitorCountRef.current;

        if (count <= 1) return;

        clientRef.current.sendSize(0, 0, count - 1, 0);
        monitorCountRef.current = count - 1;
        setMonitorCount(count - 1);
        if (activeMonitorRef.current > count - 2) selectMonitor(count - 2);
    };

    const updatePoppedOutMonitors = (monitors) => {
        poppedOutMonitorsRef.current = monitors;
        setPoppedOutMonitors(monitors);
    };

    const popOutMonitor = (index) => {
        if (!ownsSession || index < 0 || index >= monitorCountRef.current) return;

        const poppedOut = new Set(poppedOutMonitorsRef.current).add(index);
        updatePoppedOutMonitors(poppedOut);

        if (activeMonitorRef.current === index) {
            const remaining = Array.from({ length: monitorCountRef.current }, (_, i) => i)
                .find((i) => !poppedOut.has(i));
            selectMonitor(remaining ?? 0);
        }

        openPopout(session.id, index);
    };

    useEffect(() => {
        if (!ownsSession) return;

        return onPopoutClosed((sessionId, monitor) => {
            if (sessionId !== session.id || monitor === null) return;

            const poppedOut = new Set(poppedOutMonitorsRef.current);
            if (poppedOut.delete(monitor)) updatePoppedOutMonitors(poppedOut);
        });
    }, [session.id, ownsSession]);

    const sendClipboardToServer = (text) => {
        if (!clientRef.current || !text) return;
        const writer = new Guacamole.StringWriter(clientRef.current.createClipboardStream("text/plain"));
        writer.sendText(text);
        writer.sendEnd();
    };

    const checkClipboardPermission = async () => {
        try {
            return (await navigator.permissions.query({ name: "clipboard-read" })).state === "granted";
        } catch {
            return false;
        }
    };

    const handleClipboardEvents = () => {
        if (!clientRef.current) return;
        clientRef.current.onclipboard = (stream, mimetype) => {
            if (mimetype !== "text/plain") return;
            const reader = new Guacamole.StringReader(stream);
            let data = "";
            reader.ontext = (t) => data += t;
            reader.onend = async () => {
                try {
                    await navigator.clipboard.writeText(data);
                } catch {
                }
            };
        };
        checkClipboardPermission().then(ok => {
            if (!ok) return;
            let cached = "";
            setInterval(async () => {
                try {
                    const t = await navigator.clipboard.readText();
                    if (t !== cached) {
                        cached = t;
                        sendClipboardToServer(t);
                    }
                } catch {
                }
            }, 500);
        });
        const onPaste = (e) => sendClipboardToServer(e.clipboardData?.getData("text"));
        ref.current.addEventListener("paste", onPaste);
        return () => ref.current?.removeEventListener("paste", onPaste);
    };

    const connect = () => {
        if (getSessionError?.(session.id)) return;
        if (isShared) {
            if (!session.shareId || clientRef.current) return;
        } else {
            if (!sessionToken || clientRef.current) return;
        }
        let isCleaningUp = false;
        const tunnelUrl = getWebSocketUrl("/api/ws/guac/", {});
        const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
        const client = new Guacamole.Client(tunnel);
        client.getDisplay().onresize = resizeHandler;

        client.onmultimonlayout = (layout) => {
            const monitors = Object.keys(layout)
                .map(Number).filter(Number.isInteger).sort((a, b) => a - b)
                .map((index) => layout[index]);
            if (!monitors.length) return;

            layoutRef.current = monitors;
            monitorCountRef.current = monitors.length;
            setMonitorCount(monitors.length);

            if (activeMonitorRef.current > monitors.length - 1) selectMonitor(monitors.length - 1);
            else applyViewport();
        };

        client.onargv = (stream, mimetype, name) => {
            if (name !== "secondary-monitors" || mimetype !== "text/plain") return;

            const reader = new Guacamole.StringReader(stream);
            let data = "";
            reader.ontext = (text) => data += text;
            reader.onend = () => {
                const secondary = Number.parseInt(data.trim(), 10);
                if (!Number.isFinite(secondary)) return;

                const max = secondary + 1;
                maxMonitorsRef.current = max;
                setMaxMonitors(max);
            };
        };

        let loaderHidden = false;
        const clientOnInstruction = tunnel.oninstruction;
        tunnel.oninstruction = (opcode, args) => {
            if (!loaderHidden && opcode === "blob") {
                loaderHidden = true;
                connectionLoaderRef.current?.hide();
                setReady(true);
            }
            if (opcode === "error" && args?.length) {
                errorMessageRef.current = args[0] || "Connection failed";
            }
            clientOnInstruction?.(opcode, args);
        };

        clientRef.current = client;
        const display = client.getDisplay().getElement();
        display.style.position = "absolute";
        display.style.imageRendering = "crisp-edges";
        ref.current.appendChild(display);

        client.onaudio = (stream, mimetype) => {
            const audioPlayer = Guacamole.AudioPlayer.getInstance(stream, mimetype);
            if (audioPlayer) {
                audioPlayersRef.current.push(audioPlayer);
                return audioPlayer;
            }
            return null;
        };

        const s = sessionRef.current;
        let params = isShared ? `shareId=${session.shareId}` : `sessionToken=${sessionToken}&sessionId=${s.id}`;
        if (!isShared && pinnedMonitor !== null) params += `&monitor=${pinnedMonitor}`;

        client.connect(params);

        const mouse = new Guacamole.Mouse(display);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (state) => {
            if (!scaleRef.current || !offsetRef.current) return;

            if (draggingRef.current) return;

            if (zoomRef.current > ZOOM_MIN && state.middle) {
                const previous = panDragRef.current;
                panDragRef.current = { x: state.x, y: state.y };

                if (previous) {
                    panRef.current = {
                        x: panRef.current.x + state.x - previous.x,
                        y: panRef.current.y + state.y - previous.y,
                    };
                    applyViewport();
                }

                return;
            }

            panDragRef.current = null;

            resumeAudioContext();
            client.sendMouseState(new Guacamole.Mouse.State(
                Math.round((state.x - offsetRef.current.x) / scaleRef.current),
                Math.round((state.y - offsetRef.current.y) / scaleRef.current),
                state.left, state.middle, state.right, state.up, state.down,
            ));
        };
        ref.current.focus();

        const handleKeyDown = (e) => {
            const kb = getParsedKeybind("fullscreen");
            if (kb && matchesKeybind(e, kb)) {
                e.preventDefault();
                e.stopPropagation();
                onFullscreenToggleRef.current?.();
                return false;
            }
        };
        ref.current.addEventListener("keydown", handleKeyDown, true);

        const keyboard = new Guacamole.Keyboard(ref.current);
        keyboard.onkeydown = (k, sc) => {
            resumeAudioContext();
            client.sendKeyEvent(1, k, sc);
        };
        keyboard.onkeyup = (k, sc) => client.sendKeyEvent(0, k, sc);

        client.onstatechange = (st) => {
            if (isCleaningUp) return;
            if (st === Guacamole.Client.State.DISCONNECTED || st === Guacamole.Client.State.ERROR) {
                if (errorShownRef.current) return;
                if (errorMessageRef.current) reportError(errorMessageRef.current);
                else disconnectFromServer(s.id);
            }
        };
        tunnel.onstatechange = (st) => {
            if (isCleaningUp || st !== Guacamole.Tunnel.State.CLOSED) return;
            if (errorShownRef.current) return;
            if (errorMessageRef.current) reportError(errorMessageRef.current);
            else disconnectFromServer(s.id);
        };
        tunnel.onerror = (status) => {
            if (isCleaningUp) return;
            const message = status?.message || errorMessageRef.current || t("common.errors.connection.error");
            reportError(message);
        };
        handleClipboardEvents();

        return () => {
            isCleaningUp = true;
            errorShownRef.current = false;
            ref.current?.removeEventListener("keydown", handleKeyDown, true);
            client.onstatechange = tunnel.onstatechange = tunnel.onerror = null;
            audioPlayersRef.current = [];
            tunnel.disconnect();
            clientRef.current = null;

            layoutRef.current = null;
            lastSentRef.current = { w: 0, h: 0, monitor: -1, at: 0 };
            monitorCountRef.current = 1;
            activeMonitorRef.current = initialMonitor;
            maxMonitorsRef.current = 1;
            heldModifiersRef.current = new Set();
            draggingRef.current = false;
            zoomRef.current = ZOOM_MIN;
            panRef.current = { x: 0, y: 0 };
            panDragRef.current = null;
            setReady(false);
            setMonitorCount(1);
            setActiveMonitor(initialMonitor);
            setMaxMonitors(1);
            setHeldModifiers(new Set());
            setZoom(ZOOM_MIN);
        };
    };

    useEffect(() => {
        const cleanup = connect();
        return () => cleanup?.();
    }, [sessionToken, session.id, isShared]);

    useEffect(() => {
        window.addEventListener("blur", releaseModifiers);
        return () => window.removeEventListener("blur", releaseModifiers);
    }, []);

    useEffect(() => {
        window.addEventListener("resize", resizeHandler);
        const observer = ref.current && new ResizeObserver(resizeHandler);
        observer?.observe(ref.current);
        resizeHandler();
        const interval = setInterval(() => clientRef.current && ref.current && resizeHandler(), 500);
        return () => {
            window.removeEventListener("resize", resizeHandler);
            observer?.disconnect();
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="guac-container" ref={ref} tabIndex="0" onClick={() => ref.current.focus()}
             style={{
                 position: "relative",
                 width: "100%",
                 height: "100%",
                 outline: "none",
                 overflow: "hidden",
                 backgroundColor: "#000",
                 cursor: "none",
             }}>
            <ConnectionLoader onReady={(loader) => {
                connectionLoaderRef.current = loader;
            }} />
            {ready && (
                <SessionToolbar containerRef={ref} monitorCount={monitorCount} activeMonitor={activeMonitor}
                                maxMonitors={maxMonitors} heldModifiers={heldModifiers} readOnly={isShared}
                                poppedOutMonitors={poppedOutMonitors} allowMonitors={pinnedMonitor === null}
                                onSelectMonitor={selectMonitor} onAddMonitor={addMonitor}
                                onRemoveMonitor={removeMonitor} onPopOutMonitor={popOutMonitor}
                                onToggleModifier={toggleModifier} onSendShortcut={sendShortcut}
                                zoom={zoom} minZoom={ZOOM_MIN} maxZoom={ZOOM_MAX}
                                onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom}
                                onDraggingChange={(dragging) => draggingRef.current = dragging} />
            )}
            {connectionError && (
                <ConnectionError message={connectionError} onClose={() => disconnectFromServer(session.id)} />
            )}
        </div>
    );
};

export default GuacamoleRenderer;