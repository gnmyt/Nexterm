import { useEffect, useRef, useState, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { Terminal as Xterm } from "xterm";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { FitAddon } from "xterm-addon-fit/src/FitAddon";
import SnippetsMenu from "./components/SnippetsMenu";
import AICommandPopover from "./components/AICommandPopover";
import { mdiCodeArray } from "@mdi/js";
import Icon from "@mdi/react";
import "xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer, pve }) => {
    const ref = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const { theme } = useTheme();
    const { isAIAvailable } = useAI();
    const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);
    const [showAIPopover, setShowAIPopover] = useState(false);
    const [aiPopoverPosition, setAIPopoverPosition] = useState(null);

    const toggleSnippetsMenu = () => setShowSnippetsMenu(!showSnippetsMenu);

    const toggleAIPopover = () => {
        if (!showAIPopover && termRef.current) {
            const term = termRef.current;
            const terminalElement = ref.current;

            if (terminalElement) {
                const rect = terminalElement.getBoundingClientRect();
                const buffer = term.buffer.active;

                const charWidth = rect.width / term.cols;
                const charHeight = rect.height / term.rows;

                const cursorX = rect.left + (buffer.cursorX * charWidth);
                const cursorY = rect.top + (buffer.cursorY * charHeight);

                setAIPopoverPosition({ x: cursorX, y: cursorY });
            }
        }
        setShowAIPopover(!showAIPopover);
    };

    const handleSnippetSelected = (command) => {
        if (termRef.current && wsRef.current) {
            const commandWithNewline = command.endsWith("\n") ? command : command + "\n";+
            wsRef.current.send(commandWithNewline);
            termRef.current.focus();
        }
    };

    const handleAICommandGenerated = (command) => {
        if (termRef.current && wsRef.current) {
            wsRef.current.send(command);
        }
    };

    useEffect(() => {
        if (!sessionToken) return;

        const term = new Xterm({
            cursorBlink: true,
            fontSize: 16,
            fontFamily: "monospace",
            theme: {
                background: theme === "light" ? "#F3F3F3" : "#13181C",
                foreground: theme === "light" ? "#000000" : "#F5F5F5",
                brightWhite: theme === "light" ? "#464545" : "#FFFFFF",
                cursor: theme === "light" ? "#000000" : "#F5F5F5"
            },
        });

        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(ref.current);

        const handleResize = () => {
            fitAddon.fit();
            wsRef.current.send(`\x01${term.cols},${term.rows}`);
        };

        window.addEventListener("resize", handleResize);

        const protocol = location.protocol === "https:" ? "wss" : "ws";

        let url;
        let ws;

        if (pve) {
            url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/pve-lxc` : "localhost:6989/api/servers/pve-lxc";
            ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${session.server}&containerId=${session.containerId}`);
        } else {
            url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/sshd` : "localhost:6989/api/servers/sshd";
            ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${session.server}&identityId=${session.identity}`);
        }

        wsRef.current = ws;

        let interval = setInterval(() => {
            if (ws.readyState === ws.OPEN) handleResize();
        }, 300);

        ws.onopen = () => {
            ws.send(`\x01${term.cols},${term.rows}`);
        }

        ws.onclose = (event) => {
            if (event.wasClean) {
                clearInterval(interval);
                disconnectFromServer(session.id);
            }
        };

        ws.onmessage = (event) => {
            const data = event.data;

            if (data.startsWith("\x02")) {
                const prompt = data.substring(1);
                term.write(prompt);

                let totpCode = "";
                const onKey = term.onKey((key) => {
                    if (key.domEvent.key === "Enter") {
                        ws.send(`\x03${totpCode}`);
                        term.write("\r\n");
                        totpCode = "";
                        onKey.dispose();
                    } else if (key.domEvent.key === "Backspace" && totpCode.length > 0) {
                        totpCode = totpCode.slice(0, -1);
                        term.write("\b \b");
                    } else {
                        totpCode += key.key;
                        term.write(key.key);
                    }
                });
            } else {
                term.write(data);
            }
        };

        term.onData((data) => {
            ws.send(data);
        });

        term.attachCustomKeyEventHandler((event) => {
            if (event.ctrlKey && event.key === "k" && event.type === "keydown" && isAIAvailable()) {
                event.preventDefault();
                toggleAIPopover();
                return false;
            }
            return true;
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            ws.close();
            term.dispose();
            clearInterval(interval);
            termRef.current = null;
            wsRef.current = null;
        };
    }, [sessionToken]);

    return (
        <div className="xterm-container">
            <div ref={ref} className="xterm-wrapper" />
            <button 
                className={`snippets-button ${showSnippetsMenu ? 'hidden' : ''}`} 
                onClick={toggleSnippetsMenu} 
                title="Snippets"
            >
                <Icon path={mdiCodeArray} />
            </button>
            <SnippetsMenu 
                visible={showSnippetsMenu} 
                onClose={() => setShowSnippetsMenu(false)}
                onSelect={handleSnippetSelected}
            />
            {isAIAvailable() && (
                <AICommandPopover visible={showAIPopover} onClose={() => setShowAIPopover(false)}
                                  onCommandGenerated={handleAICommandGenerated} position={aiPopoverPosition}
                                  focusTerminal={() => termRef.current?.focus()} />
            )}
        </div>
    );
};

export default XtermRenderer;
