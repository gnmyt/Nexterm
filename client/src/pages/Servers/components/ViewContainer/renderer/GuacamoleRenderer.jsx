import { useEffect, useRef, useContext, useState } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import "./styles/GuacamoleRenderer.sass";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiChevronRight } from "@mdi/js";

const GuacamoleRenderer = ({ session, disconnectFromServer, pve }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ y: 0, menuY: 0 });

    const quickCommands = [
        { label: "Ctrl+Alt+Del", keys: [0xffe3, 0xffe9, 0xffff] },
        { label: "Alt+Tab", keys: [0xffe9, 0xff09] },
        { label: "Windows Key", keys: [0xffeb] },
        { label: "Ctrl+Shift+Esc", keys: [0xffe3, 0xffe1, 0xff1b] },
        { label: "Alt+F4", keys: [0xffe9, 0xffc1] },
        { label: "Win+L", keys: [0xffeb, 0x6c] },
        { label: "Win+R", keys: [0xffeb, 0x72] },
        { label: "Ctrl+Alt+F1", keys: [0xffe3, 0xffe9, 0xffbe] },
        { label: "Ctrl+Alt+F2", keys: [0xffe3, 0xffe9, 0xffbf] },
        { label: "Ctrl+Alt+Backspace", keys: [0xffe3, 0xffe9, 0xff08] },
    ];

    const sendKeySequence = (keys) => {
        if (!clientRef.current) {
            console.warn("GuacamoleRenderer: Cannot send key sequence - client not connected");
            return;
        }

        setTimeout(() => {
            keys.forEach(key => clientRef.current.sendKeyEvent(1, key));

            setTimeout(() => [...keys].reverse().forEach(key => clientRef.current.sendKeyEvent(0, key)), 50);
        }, 100);

        setMenuVisible(false);
    };

    const handleChevronClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isDragging) setMenuVisible(prev => !prev);
    };

    const handleChevronMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.button !== 0 && !e.shiftKey) return;


        const startPos = { x: e.clientX, y: e.clientY };
        let hasStartedDragging = false;
        let dragThreshold = 10;

        const handleMouseMove = (moveEvent) => {
            const distance = Math.sqrt(Math.pow(moveEvent.clientX - startPos.x, 2) + Math.pow(moveEvent.clientY - startPos.y, 2));

            if (distance > dragThreshold && !hasStartedDragging) {
                hasStartedDragging = true;
                setIsDragging(true);
                dragStartRef.current = { y: startPos.y, menuY: menuPosition.y };
            }

            if (hasStartedDragging) {
                moveEvent.preventDefault();
                moveEvent.stopPropagation();

                const deltaY = moveEvent.clientY - dragStartRef.current.y;
                const containerHeight = ref.current?.clientHeight || window.innerHeight;
                const menuHeight = 35;
                const maxY = containerHeight - menuHeight - 10;
                const newY = Math.max(10, Math.min(maxY, dragStartRef.current.menuY + deltaY));
                setMenuPosition({ y: newY });
            }
        };

        const handleMouseUp = (upEvent) => {
            document.removeEventListener("mousemove", handleMouseMove, true);
            document.removeEventListener("mouseup", handleMouseUp, true);

            if (hasStartedDragging) {
                upEvent.preventDefault();
                upEvent.stopPropagation();

                setTimeout(() => setIsDragging(false), 50);
            }
        };

        document.addEventListener("mousemove", handleMouseMove, true);
        document.addEventListener("mouseup", handleMouseUp, true);
    };

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

        const urlSuffix = pve ? "pve-qemu" : "guacd";

        const tunnel = new Guacamole.WebSocketTunnel((process.env.NODE_ENV === "production" ? "/api/servers/"
            : "ws://localhost:6989/api/servers/") + urlSuffix);
        const client = new Guacamole.Client(tunnel);

        client.getDisplay().onresize = resizeHandler;

        clientRef.current = client;

        const displayElement = client.getDisplay().getElement();

        displayElement.style.position = "absolute";
        displayElement.style.imageRendering = "crisp-edges";
        ref.current.appendChild(displayElement);

        if (pve) {
            const connectionParams = `sessionToken=${sessionToken}&serverId=${session.server.id}&containerId=${session.containerId}`;
            const connectionString = session.connectionReason 
                ? `${connectionParams}&connectionReason=${encodeURIComponent(session.connectionReason)}`
                : connectionParams;
            client.connect(connectionString);
        } else {
            const connectionParams = `sessionToken=${sessionToken}&serverId=${session.server.id}&identity=${session.identity}`;
            const connectionString = session.connectionReason 
                ? `${connectionParams}&connectionReason=${encodeURIComponent(session.connectionReason)}`
                : connectionParams;
            client.connect(connectionString);
        }

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
             onClick={() => {
                 ref.current.focus();
                 setMenuVisible(false);
             }}
             style={{
                 position: "relative", width: "100%", height: "100%", outline: "none",
                 overflow: "hidden", backgroundColor: "#000", cursor: "none",
             }}>
            <div className={`quick-commands-chevron ${isDragging ? "dragging" : ""}`} onClick={handleChevronClick}
                 style={{ top: `${menuPosition.y}px` }} onMouseDown={handleChevronMouseDown}>
                <span className={`chevron-icon ${menuVisible ? "open" : ""}`}>
                    <Icon path={menuVisible ? mdiChevronDown : mdiChevronRight} size={1} />
                </span>
            </div>

            {menuVisible && (
                <div className="quick-commands-menu" style={{ top: `${menuPosition.y}px` }}
                     onClick={(e) => e.stopPropagation()}>
                    {quickCommands.map((command, index) => (
                        <div key={index} className="quick-command-item"
                             onClick={() => sendKeySequence([...command.keys])}>
                            {command.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GuacamoleRenderer;