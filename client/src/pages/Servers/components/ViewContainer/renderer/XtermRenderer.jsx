import { useEffect, useRef, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { Terminal as Xterm } from "xterm";
import { FitAddon } from "xterm-addon-fit/src/FitAddon";

import "xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);

    useEffect(() => {
        if (!sessionToken) return;

        const term = new Xterm({
            cursorBlink: true,
            fontSize: 16,
            fontFamily: "monospace",
            theme: { background: "#13181C" },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(ref.current);

        const handleResize = () => {
            fitAddon.fit();
            ws.send(`\x01${term.cols},${term.rows}`);
        };

        window.addEventListener("resize", handleResize);

        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/sshd` : "localhost:6989/api/servers/sshd";
        const ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${session.server}&identityId=${session.identity}`);


        let interval = setInterval(() => {
            if (ws.readyState === ws.OPEN) handleResize();
        }, 1000);

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
            term.write(event.data);
        };

        term.onData((data) => {
            ws.send(data);
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            ws.close();
            term.dispose();
            clearInterval(interval);
        };
    }, [sessionToken]);

    return (
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
    );
};

export default XtermRenderer;
