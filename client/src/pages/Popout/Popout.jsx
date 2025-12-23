import "./styles.sass";
import { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import Loading from "@/common/components/Loading";
import TitleBar from "@/common/components/TitleBar";
import { isTauri } from "@/common/utils/TauriUtil.js";

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexterm_popout") : null;
const noop = () => {};

export const Popout = () => {
    const { sessionId } = useParams();
    const { user } = useContext(UserContext);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const refs = useRef({});
    const isConnectorMode = isTauri();

    useEffect(() => {
        if (!sessionId || !user) return;
        getRequest(`/connections/${sessionId}`)
            .then(data => { setSession(data); if (data.server?.name) document.title = `${data.server.name} - Nexterm`; })
            .finally(() => setLoading(false));
    }, [sessionId, user]);

    useEffect(() => {
        if (isConnectorMode) return;
        const cleanup = () => channel?.postMessage({ type: "popout_closed", sessionId });
        window.addEventListener("beforeunload", cleanup);
        return () => window.removeEventListener("beforeunload", cleanup);
    }, [sessionId, isConnectorMode]);

    if (loading) return <Loading />;
    if (!session || session.error) return null;

    const renderer = session.type || session.server?.renderer;
    const closeWindow = () => window.close();
    const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

    return (
        <div className="popout-container">
            {isConnectorMode && <TitleBar title={session.server?.name || "Session"} />}
            {renderer === "guac" && <GuacamoleRenderer session={session} disconnectFromServer={closeWindow} registerGuacamoleRef={noop} onFullscreenToggle={fullscreen} />}
            {renderer === "terminal" && <XtermRenderer session={session} disconnectFromServer={closeWindow} registerTerminalRef={noop} broadcastMode={false} terminalRefs={refs} updateProgress={noop} layoutMode="single" onBroadcastToggle={noop} onFullscreenToggle={fullscreen} />}
        </div>
    );
};
