import { useEffect, useRef, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { Terminal as Xterm } from "xterm";
import { FitAddon } from "xterm-addon-fit/src/FitAddon";

import "xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer, pve }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);

    useEffect(() => {
        if (!sessionToken) return;

        const term = new Xterm({
            cursorBlink: true,
            fontSize: 16,
            fontFamily: "monospace",
            theme: { background: "#13181C" },
            //macOptionIsMeta: true
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

        let url;
        let ws;

        if (pve) {
            url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/pve-lxc` : "localhost:6989/api/servers/pve-lxc";
            ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${session.server}&containerId=${session.containerId}`);
        } else {
            url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/sshd` : "localhost:6989/api/servers/sshd";
            ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${session.server}&identityId=${session.identity}`);
        }

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

        
        let totpCode = "";
        let content;
        ws.onmessage = (event) => {
            content = event.data;
            try {
               content = JSON.parse(event.data)

              if(content.event == "keyboard-interactive" && content.type == "totp") {
                term.write(content.prompt)
                
                const onDataDisposable = term.onData((data) => {
                    term.write(data)
                    totpCode += data;
                    
                    // stop listening for the event  
                    onDataDisposable.dispose();

                });

                const disposable = term.onKey((key) => {

                  if(key.domEvent.key == "Enter") {
                    console.log("Sending otp:", totpCode);

                    if(totpCode !== "" && Number.isSafeInteger(Number(totpCode))) {
                      ws.send('{"event": "totp-answer", "value": "' + totpCode + '"}');
                      totpCode = "";
                    }
                    
                    // stop listening for the event
                    key.domEvent.stopPropagation()
                    key.domEvent.preventDefault()
                    disposable.dispose();
                  }
                })

              }
              content = undefined;
              return;
            } catch (e) {
                term.write(content);

            }    // will only throw json parsing errors -> we don't need it    
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
