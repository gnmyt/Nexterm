import { useEffect, useRef, useContext } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";

const GuacamoleRenderer = ({ session, disconnectFromServer, registerGuacamoleRef, onFullscreenToggle }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const { getParsedKeybind } = useKeymaps();
    const onFullscreenToggleRef = useRef(onFullscreenToggle);

    useEffect(() => {
        onFullscreenToggleRef.current = onFullscreenToggle;
    }, [onFullscreenToggle]);

    useEffect(() => {
        if (registerGuacamoleRef && clientRef.current) {
            registerGuacamoleRef(session.id, { client: clientRef.current });
        }
        return () => {
            if (registerGuacamoleRef) {
                registerGuacamoleRef(session.id, null);
            }
        };
    }, [session.id, registerGuacamoleRef, clientRef.current]);

    const applyDisplayStyles = (displayElement, offsetX, offsetY, scale) => {
        Object.assign(displayElement.style, {
            position: "absolute",
            width: displayElement.clientWidth + "px",
            height: displayElement.clientHeight + "px",
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: "0 0",
            imageRendering: "crisp-edges",
            backfaceVisibility: "hidden",
            willChange: "transform",
        });
    };

    const resizeHandler = () => {
        if (clientRef.current && ref.current) {
            const displayElement = clientRef.current.getDisplay().getElement();
            const containerWidth = ref.current.clientWidth;
            const containerHeight = ref.current.clientHeight;

            clientRef.current.sendSize(containerWidth, containerHeight);

            const scaleX = containerWidth / displayElement.clientWidth;
            const scaleY = containerHeight / displayElement.clientHeight;
            const scale = Math.min(scaleX, scaleY);
            scaleRef.current = scale;

            const scaledWidth = displayElement.clientWidth * scale;
            const scaledHeight = displayElement.clientHeight * scale;

            const offsetX = (containerWidth - scaledWidth) / 2;
            const offsetY = (containerHeight - scaledHeight) / 2;
            offsetRef.current = { x: offsetX, y: offsetY };

            applyDisplayStyles(displayElement, offsetX, offsetY, scale);
        }
    };

    const sendClipboardToServer = (text) => {
        if (clientRef.current && text) {
            const stream = clientRef.current.createClipboardStream("text/plain");
            const writer = new Guacamole.StringWriter(stream);
            writer.sendText(text);
            writer.sendEnd();
        }
    };

    const checkClipboardPermission = async () => {
        try {
            const result = await navigator.permissions.query({ name: "clipboard-read" });
            return result.state === "granted";
        } catch (e) {
            return false;
        }
    };

    const handleClipboardEvents = () => {
        if (clientRef.current) {
            clientRef.current.onclipboard = (stream, mimetype) => {
                if (mimetype === "text/plain") {
                    const reader = new Guacamole.StringReader(stream);
                    let clipboardData = "";

                    reader.ontext = (text) => clipboardData += text;
                    reader.onend = async () => {
                        try {
                            await navigator.clipboard.writeText(clipboardData);
                        } catch (ignored) {
                        }
                    };
                }
            };

            checkClipboardPermission().then(hasPermission => {
                if (hasPermission) {
                    let cachedClipboard = "";
                    const intervalId = setInterval(async () => {
                        try {
                            const text = await navigator.clipboard.readText();
                            if (text !== cachedClipboard) {
                                cachedClipboard = text;
                                sendClipboardToServer(text);
                            }
                        } catch (ignored) {
                        }
                    }, 500);

                    return () => clearInterval(intervalId);
                }
            });

            const handlePaste = (e) => {
                const text = e.clipboardData?.getData("text");
                if (text) {
                    sendClipboardToServer(text);
                }
            };

            ref.current.addEventListener("paste", handlePaste);
            return () => {
                ref.current.removeEventListener("paste", handlePaste);
            };
        }
    };

    const connect = () => {
        if (!sessionToken || clientRef.current) {
            return;
        }

        const tunnel = new Guacamole.WebSocketTunnel((process.env.NODE_ENV === "production" ? "/api/ws/guac/"
            : "ws://localhost:6989/api/ws/guac"));
        const client = new Guacamole.Client(tunnel);

        client.getDisplay().onresize = resizeHandler;

        clientRef.current = client;

        const displayElement = client.getDisplay().getElement();

        displayElement.style.position = "absolute";
        displayElement.style.imageRendering = "crisp-edges";
        ref.current.appendChild(displayElement);

        const connectionParams = `sessionToken=${sessionToken}&entryId=${session.server.id}&identity=${session.identity}&sessionId=${session.id}`;
        const connectionString = session.connectionReason
            ? `${connectionParams}&connectionReason=${encodeURIComponent(session.connectionReason)}`
            : connectionParams;
        client.connect(connectionString);

        const mouse = new Guacamole.Mouse(displayElement);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState) => {
            if (scaleRef.current && offsetRef.current) {
                const adjustedX = (mouseState.x - offsetRef.current.x) / scaleRef.current;
                const adjustedY = (mouseState.y - offsetRef.current.y) / scaleRef.current;

                const adjustedState = new Guacamole.Mouse.State(
                    Math.round(adjustedX), Math.round(adjustedY), mouseState.left, mouseState.middle,
                    mouseState.right, mouseState.up, mouseState.down);
                client.sendMouseState(adjustedState);
            }
        };

        ref.current.focus();

        const handleKeyDown = (event) => {
            const fullscreenKeybind = getParsedKeybind("fullscreen");
            if (fullscreenKeybind && matchesKeybind(event, fullscreenKeybind)) {
                event.preventDefault();
                event.stopPropagation();
                onFullscreenToggleRef.current?.();
                return false;
            }
        };

        ref.current.addEventListener("keydown", handleKeyDown, true);

        const keyboard = new Guacamole.Keyboard(ref.current);
        keyboard.onkeydown = (keysym) => client.sendKeyEvent(1, keysym);
        keyboard.onkeyup = (keysym) => client.sendKeyEvent(0, keysym);

        client.onstatechange = (state) => {
            if (state === Guacamole.Client.State.DISCONNECTED) disconnectFromServer(session.id);

            if (state === Guacamole.Client.State.ERROR) {
                console.error("Guacamole error");
                disconnectFromServer(session.id);
            }
        };

        handleClipboardEvents();

        return () => {
            if (ref.current) {
                ref.current.removeEventListener("keydown", handleKeyDown, true);
            }
            client.onstatechange = null;
            client.disconnect();
            clientRef.current = null;
        };
    };

    useEffect(() => {
        connect();
    }, [sessionToken, session]);

    useEffect(() => {
        let resizeObserver;
        window.addEventListener("resize", resizeHandler);

        if (ref.current) {
            resizeObserver = new ResizeObserver(() => {
                resizeHandler();
            });
            resizeObserver.observe(ref.current);
        }

        resizeHandler();

        const resizeInterval = setInterval(() => {
            if (clientRef.current && ref.current) resizeHandler();
        }, 500);

        return () => {
            window.removeEventListener("resize", resizeHandler);
            if (resizeObserver) resizeObserver.disconnect();
            clearInterval(resizeInterval);
        };
    }, []);

    return (
        <div className="guac-container" ref={ref} tabIndex="0"
            onClick={() => ref.current.focus()}
            style={{
                position: "relative", width: "100%", height: "100%", outline: "none",
                overflow: "hidden", backgroundColor: "#000", cursor: "none",
            }}>
        </div>
    );
};

export default GuacamoleRenderer;