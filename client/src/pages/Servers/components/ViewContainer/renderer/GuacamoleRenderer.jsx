import { useEffect, useRef, useContext } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";

const GuacamoleRenderer = ({ session, disconnectFromServer, pve }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);

    const resizeHandler = () => {
        if (clientRef.current && ref.current) {
            const displayElement = clientRef.current.getDisplay().getElement();
            const width = ref.current.clientWidth;
            const height = ref.current.clientHeight;

            if (displayElement.clientWidth !== width || displayElement.clientHeight !== height)
                clientRef.current.sendSize(width, height);

            const scale = Math.min(width / displayElement.clientWidth, height / displayElement.clientHeight);

            displayElement.style.transform = `scale(${scale})`;
            displayElement.style.transformOrigin = "top left";

            displayElement.style.position = "absolute";
            displayElement.style.left = `${(width - displayElement.clientWidth * scale) / 2}px`;
            displayElement.style.top = `${(height - displayElement.clientHeight * scale) / 2}px`;
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

        const urlSuffix = pve ? "pve-qemu" : "guacd";

        const tunnel = new Guacamole.WebSocketTunnel((process.env.NODE_ENV === "production" ? "/api/servers/"
                : "ws://localhost:6989/api/servers/") + urlSuffix);
        const client = new Guacamole.Client(tunnel);

        clientRef.current = client;

        const displayElement = client.getDisplay().getElement();
        ref.current.appendChild(displayElement);

        if (pve) {
            client.connect(`sessionToken=${sessionToken}&serverId=${session.server}&containerId=${session.containerId}`);
        } else {
            client.connect(`sessionToken=${sessionToken}&serverId=${session.server}&identity=${session.identity}`);
        }

        const mouse = new Guacamole.Mouse(displayElement);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState) => {
            client.sendMouseState(mouseState);
        };

        ref.current.focus();

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
            client.disconnect();
            clientRef.current = null;
        };
    };

    useEffect(() => {
        connect();
    }, [sessionToken, session]);

    useEffect(() => {
        window.addEventListener("resize", resizeHandler);

        const interval = setInterval(() => {
            if (clientRef.current) resizeHandler();
        }, 500);

        return () => {
            window.removeEventListener("resize", resizeHandler);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="guac-container" ref={ref} tabIndex="0" onClick={() => ref.current.focus()}
             style={{
                 position: "relative", zIndex: 1, outline: "none", display: "flex", justifyContent: "center",
                 alignItems: "center", width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#000000",
                 cursor: "none",
             }}
        />
    );
};

export default GuacamoleRenderer;
