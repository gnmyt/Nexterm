import { useEffect, useRef, useContext } from "react";
import Guacamole from 'guacamole-common-js';
import { UserContext } from "@/common/contexts/UserContext.jsx";

const GuacamoleRenderer = ({ session, disconnectFromServer }) => {
    const ref = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const clientRef = useRef(null);

    const resizeHandler = () => {
        if (clientRef.current && ref.current) {
            const displayElement = clientRef.current.getDisplay().getElement();
            const width = ref.current.clientWidth;
            const height = ref.current.clientHeight;
            if (displayElement.clientWidth !== width || displayElement.clientHeight !== height) {
                clientRef.current.sendSize(width, height);
            }
        }
    };

    const connect = () => {
        if (!sessionToken || clientRef.current) {
            return;
        }

        const tunnel = new Guacamole.WebSocketTunnel('ws://localhost:6989/api/servers/guacd');
        const client = new Guacamole.Client(tunnel);

        clientRef.current = client;

        const displayElement = client.getDisplay().getElement();
        ref.current.appendChild(displayElement);

        client.connect(`sessionToken=${sessionToken}&serverId=${session.server}&identity=${session.identity}`);

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
        return () => {
            client.disconnect();
            clientRef.current = null;
        };
    };

    useEffect(() => {
        connect();
    }, [sessionToken, session]);

    useEffect(() => {
        window.addEventListener('resize', resizeHandler);

        const interval = setInterval(() => {
            if (clientRef.current) resizeHandler();
        }, 500);

        return () => {
            window.removeEventListener('resize', resizeHandler);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="guac-container" ref={ref} tabIndex="0" onClick={() => ref.current.focus()}
             style={{position: 'relative', zIndex: 1, outline: "none", display: "flex", justifyContent: "center",
                 alignItems: "center", width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#000000",
                 cursor: "none"}}
        />
    );
}

export default GuacamoleRenderer;
