import "./styles.sass";
import { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import Loading from "@/common/components/Loading";

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexterm_popout") : null;
const noop = () => {};

export const Popout = () => {
    const { sessionId } = useParams();
    const { user } = useContext(UserContext);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const refs = useRef({});

    useEffect(() => {
        if (!sessionId || !user) return;
        getRequest(`/connections/${sessionId}`)
            .then(data => { setSession(data); if (data.server?.name) document.title = `${data.server.name} - Nexterm`; })
            .finally(() => setLoading(false));
    }, [sessionId, user]);

    useEffect(() => {
        const cleanup = () => channel?.postMessage({ type: "popout_closed", sessionId });
        window.addEventListener("beforeunload", cleanup);
        return () => window.removeEventListener("beforeunload", cleanup);
    }, [sessionId]);

    if (loading) return <Loading />;
    if (!session || session.error) return null;

    const renderer = session.type || session.server?.renderer;
    const disconnect = () => window.close();
    const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

    return (
        <div className="popout-container">
            {renderer === "guac" && <GuacamoleRenderer session={session} disconnectFromServer={disconnect} registerGuacamoleRef={noop} onFullscreenToggle={fullscreen} />}
            {renderer === "terminal" && <XtermRenderer session={session} disconnectFromServer={disconnect} registerTerminalRef={noop} broadcastMode={false} terminalRefs={refs} updateProgress={noop} layoutMode="single" onBroadcastToggle={noop} onFullscreenToggle={fullscreen} />}
        </div>
    );
};
