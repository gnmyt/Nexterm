import { useEffect, useRef, useContext, useState, useCallback } from "react";
import Guacamole from "guacamole-common-js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import ConnectionLoader from "./components/ConnectionLoader";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import "./styles/guacamole.sass";

const resumeAudioContext = () => {
    const context = Guacamole.AudioContextFactory.getAudioContext();
    if (context && context.state === "suspended") {
        context.resume();
    }
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
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const sessionRef = useRef(session);
    const connectionLoaderRef = useRef(null);
    const audioPlayersRef = useRef([]);
    const [isDragOver, setIsDragOver] = useState(false);

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

    const uploadFileToRemote = useCallback((file) => {
        return new Promise((resolve, reject) => {
            if (!clientRef.current || !file) {
                reject(new Error("No client or file"));
                return;
            }
            const mimetype = file.type || "application/octet-stream";
            const stream = clientRef.current.createFileStream(mimetype, file.name);
            const writer = new Guacamole.BlobWriter(stream);
            writer.oncomplete = () => {
                writer.sendEnd();
                resolve({ name: file.name, size: file.size });
            };
            writer.onerror = (blob, offset, error) => {
                reject(new Error(`Upload failed for ${file.name}`));
            };
            writer.sendBlob(file);
        });
    }, []);

    const uploadFiles = useCallback(async (files) => {
        if (!files || files.length === 0) return;
        let successCount = 0;
        let failCount = 0;
        for (const file of files) {
            try {
                await uploadFileToRemote(file);
                successCount++;
            } catch (err) {
                failCount++;
                console.error("File upload error:", err);
            }
        }
        if (successCount > 0 && failCount === 0) {
            sendToast("Success", successCount === 1
                ? `Uploaded "${files[0].name}" to remote drive`
                : `Uploaded ${successCount} files to remote drive`);
        } else if (failCount > 0) {
            sendToast("Error", `${failCount} file(s) failed to upload`
                + (successCount > 0 ? `, ${successCount} succeeded` : ""));
        }
    }, [uploadFileToRemote, sendToast]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("Files")) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await uploadFiles(files);
        }
    }, [uploadFiles]);

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
        const onPaste = (e) => {
            if (e.clipboardData?.files?.length > 0) {
                e.preventDefault();
                uploadFiles(Array.from(e.clipboardData.files));
                return;
            }
            const text = e.clipboardData?.getData("text");
            if (text) {
                sendClipboardToServer(text);
                // After clipboard syncs, send V key to RDP (Ctrl is already held)
                setTimeout(() => {
                    if (clientRef.current) {
                        clientRef.current.sendKeyEvent(1, 0x0076);
                        clientRef.current.sendKeyEvent(0, 0x0076);
                    }
                }, 100);
            }
            e.preventDefault();
        };
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
            // Intercept Ctrl+V so the browser fires the paste event
            // (Guacamole.Keyboard's preventDefault blocks it otherwise)
            if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
                e.stopImmediatePropagation();
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
            if (st === Guacamole.Client.State.DISCONNECTED || st === Guacamole.Client.State.ERROR) disconnectFromServer(s.id);
        };
        tunnel.onstatechange = (st) => {
            if (!isCleaningUp && st === Guacamole.Tunnel.State.CLOSED) disconnectFromServer(s.id);
        };
        tunnel.onerror = () => {
            if (!isCleaningUp) disconnectFromServer(s.id);
        };
        handleClipboardEvents();

        // Handle file downloads from remote
        client.onfile = (stream, mimetype, filename) => {
            const reader = new Guacamole.BlobReader(stream, mimetype);
            reader.onend = () => {
                const blob = reader.getBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                sendToast("Success", `Downloaded "${filename}" from remote`);
            };
        };

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
             onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
             style={{
                 position: "relative",
                 width: "100%",
                 height: "100%",
                 outline: "none",
                 overflow: "hidden",
                 backgroundColor: "#000",
                 cursor: "none",
             }}>
            {isDragOver && (
                <div className="guac-drop-overlay">
                    <div className="guac-drop-overlay__content">
                        <div className="guac-drop-overlay__text">Drop files to upload to remote</div>
                    </div>
                </div>
            )}
            <ConnectionLoader onReady={(loader) => {
                connectionLoaderRef.current = loader;
            }} />
        </div>
    );
};

export default GuacamoleRenderer;