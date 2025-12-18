import { useEffect, useRef, useContext } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import ConnectionLoader from "./components/ConnectionLoader";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";

if (typeof document !== 'undefined') {
    let audioUnlocked = false;
    const unlockOnGesture = () => {
        if (audioUnlocked) return;
        const context = Guacamole.AudioContextFactory.getAudioContext();
        console.log('[Guac Audio] Attempting to unlock AudioContext, state:', context?.state);
        if (context) {
            context.resume().then(() => {
                audioUnlocked = true;
                console.log('[Guac Audio] AudioContext unlocked successfully, state:', context.state);
                document.removeEventListener('click', unlockOnGesture);
                document.removeEventListener('keydown', unlockOnGesture);
                document.removeEventListener('touchstart', unlockOnGesture);
            }).catch((err) => {
                console.error('[Guac Audio] Failed to unlock AudioContext:', err);
            });
        } else {
            console.warn('[Guac Audio] No AudioContext available');
        }
    };
    document.addEventListener('click', unlockOnGesture);
    document.addEventListener('keydown', unlockOnGesture);
    document.addEventListener('touchstart', unlockOnGesture);
}

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
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const sessionRef = useRef(session);
    const connectionLoaderRef = useRef(null);
    const audioPlayersRef = useRef([]);

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
            if (opcode === "audio" || opcode === "ack" || opcode === "blob" || opcode === "end") {
                if (opcode === "audio") {
                    console.log('[Guac Audio] Received audio instruction:', opcode, args);
                }
            }
            if (!loaderHidden && opcode === "blob") {
                loaderHidden = true;
                connectionLoaderRef.current?.hide();
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
            console.log('[Guac Audio] Audio stream received, mimetype:', mimetype);
            const context = Guacamole.AudioContextFactory.getAudioContext();
            console.log('[Guac Audio] AudioContext:', context);
            console.log('[Guac Audio] AudioContext state:', context?.state);

            const isSupported = Guacamole.RawAudioPlayer.isSupportedType(mimetype);
            console.log('[Guac Audio] Mimetype supported:', isSupported);
            console.log('[Guac Audio] Supported types:', Guacamole.RawAudioPlayer.getSupportedTypes());
            
            const audioPlayer = Guacamole.AudioPlayer.getInstance(stream, mimetype);
            console.log('[Guac Audio] AudioPlayer created:', !!audioPlayer, audioPlayer);
            
            if (audioPlayer) {
                audioPlayersRef.current.push(audioPlayer);
                console.log('[Guac Audio] Total audio players:', audioPlayersRef.current.length);
                return audioPlayer;
            }
            console.warn('[Guac Audio] No AudioPlayer instance created for mimetype:', mimetype);
            return null;
        };

        const s = sessionRef.current;
        const params = isShared ? `shareId=${session.shareId}` : `sessionToken=${sessionToken}&sessionId=${s.id}`;
        client.connect(params);

        const mouse = new Guacamole.Mouse(display);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (state) => {
            if (!scaleRef.current || !offsetRef.current) return;
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
        keyboard.onkeydown = (k, sc) => client.sendKeyEvent(1, k, sc);
        keyboard.onkeyup = (k, sc) => client.sendKeyEvent(0, k, sc);

        client.onstatechange = (st) => {
            if (isCleaningUp) return;
            if (st === Guacamole.Client.State.DISCONNECTED || st === Guacamole.Client.State.ERROR) disconnectFromServer(s.id);
        };
        tunnel.onstatechange = (st) => {
            if (!isCleaningUp && st === Guacamole.Tunnel.State.CLOSED) disconnectFromServer(s.id);
        };
        tunnel.onerror = () => {
            if (!isCleaningUp) disconnectFromServer(s.id);
        };
        handleClipboardEvents();

        return () => {
            isCleaningUp = true;
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
    }, [sessionToken, session.id, isShared]);

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