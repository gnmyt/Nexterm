import { useEffect, useRef, useContext } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import ConnectionLoader from "./components/ConnectionLoader";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";

const resumeAudioContext = () => {
    const context = Guacamole.AudioContextFactory.getAudioContext();
    if (context && context.state === "suspended") {
        context.resume();
    }
};

const getUserFriendlyError = (errorMessage, t) => {
    if (!errorMessage) return t('common.errors.connection.failed');
    
    const msg = errorMessage.toLowerCase();
    
    // Map common errors to user-friendly messages
    if (msg.includes('aborted') || msg.includes('see logs')) {
        return t('common.errors.connection.hostUnreachable');
    }
    if (msg.includes('connection refused')) {
        return t('common.errors.connection.refused');
    }
    if (msg.includes('no route to host') || msg.includes('unreachable')) {
        return t('common.errors.connection.hostUnreachable');
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
        return t('common.errors.connection.timeout');
    }
    if (msg.includes('authentication') || msg.includes('auth')) {
        return t('common.errors.connection.authenticationFailed');
    }
    if (msg.includes('permission denied')) {
        return t('common.errors.connection.permissionDenied');
    }
    if (msg.includes('connection not available')) {
        return t('common.errors.connection.hostUnreachable');
    }
    
    // Return cleaned message
    return errorMessage.replace(/\(see logs\)/gi, '').replace(/aborted/gi, t('common.errors.connection.failed')).trim();
};

const GuacamoleRenderer = ({
                               session,
                               disconnectFromServer,
                               registerGuacamoleRef,
                               onFullscreenToggle,
                               isShared = false,
                           }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const { getParsedKeybind } = useKeymaps();
    const { sendToast } = useToast();
    const { t } = useTranslation();
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const sessionRef = useRef(session);
    const connectionLoaderRef = useRef(null);
    const audioPlayersRef = useRef([]);
    const errorMessageRef = useRef(null);
    const errorShownRef = useRef(false);

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

    const applyDisplayStyles = (el, x, y, scale) => Object.assign(el.style, {
        position: "absolute", width: el.clientWidth + "px", height: el.clientHeight + "px",
        transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: "0 0",
        imageRendering: "crisp-edges", backfaceVisibility: "hidden", willChange: "transform",
    });

    const resizeHandler = () => {
        if (!clientRef.current || !ref.current) return;
        const display = clientRef.current.getDisplay().getElement();
        const [cw, ch] = [ref.current.clientWidth, ref.current.clientHeight];
        clientRef.current.sendSize(cw, ch);
        const scale = Math.min(cw / display.clientWidth, ch / display.clientHeight);
        scaleRef.current = scale;
        const offsetX = (cw - display.clientWidth * scale) / 2;
        const offsetY = (ch - display.clientHeight * scale) / 2;
        offsetRef.current = { x: offsetX, y: offsetY };
        applyDisplayStyles(display, offsetX, offsetY, scale);
    };

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

        let loaderHidden = false;
        const clientOnInstruction = tunnel.oninstruction;
        tunnel.oninstruction = (opcode, args) => {
            if (!loaderHidden && opcode === "blob") {
                loaderHidden = true;
                connectionLoaderRef.current?.hide();
            }
            // Capture error instructions from guacd
            if (opcode === "error" && args && args.length > 0) {
                const errorMessage = args[0] || "Connection failed";
                console.log('Guacamole error instruction:', opcode, args, errorMessage);
                errorMessageRef.current = errorMessage;
            }
            if (clientOnInstruction) {
                clientOnInstruction(opcode, args);
            }
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
        const params = isShared ? `shareId=${session.shareId}` : `sessionToken=${sessionToken}&sessionId=${s.id}`;
        client.connect(params);

        // Intercept WebSocket close after connection is established
        setTimeout(() => {
            if (tunnel.socket) {
                const ws = tunnel.socket;
                const originalOnClose = ws.onclose;
                ws.onclose = function(event) {
                    console.log('WebSocket closed:', event.code, event.reason);
                    if (event.code >= 4000 && event.reason) {
                        errorMessageRef.current = event.reason.replace('error: ', '');
                        console.log('Captured error message from WebSocket:', errorMessageRef.current);
                    }
                    if (originalOnClose) {
                        originalOnClose.call(this, event);
                    }
                };
            }
        }, 10);

        const mouse = new Guacamole.Mouse(display);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (state) => {
            if (!scaleRef.current || !offsetRef.current) return;
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
                console.log('Client state change:', st, 'Error message:', errorMessageRef.current);
                if (!errorShownRef.current && errorMessageRef.current) {
                    errorShownRef.current = true;
                    const friendlyError = getUserFriendlyError(errorMessageRef.current, t);
                    sendToast("Error", friendlyError);
                }
                setTimeout(() => disconnectFromServer(s.id), 100);
            }
        };
        tunnel.onstatechange = (st) => {
            if (!isCleaningUp && st === Guacamole.Tunnel.State.CLOSED) {
                console.log('Tunnel state change:', st, 'Error message:', errorMessageRef.current);
                if (!errorShownRef.current && errorMessageRef.current) {
                    errorShownRef.current = true;
                    const friendlyError = getUserFriendlyError(errorMessageRef.current, t);
                    sendToast("Error", friendlyError);
                }
                setTimeout(() => disconnectFromServer(s.id), 100);
            }
        };
        tunnel.onerror = (status) => {
            if (!isCleaningUp && !errorShownRef.current) {
                errorShownRef.current = true;
                const message = status?.message || errorMessageRef.current || t('common.errors.connection.error');
                console.log('Tunnel error:', status, 'Message:', message);
                const friendlyError = getUserFriendlyError(message, t);
                sendToast("Error", friendlyError);
                setTimeout(() => disconnectFromServer(s.id), 100);
            }
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
        };
    };

    useEffect(() => {
        const cleanup = connect();
        return () => cleanup?.();
    }, [sessionToken, session.id, isShared, t]);

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
        </div>
    );
};

export default GuacamoleRenderer;