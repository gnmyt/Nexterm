import "./styles.sass";
import { useEffect, useState, useRef, useContext } from "react";
import SessionOverlayBar from "@/pages/Servers/components/ViewContainer/components/SessionOverlayBar";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import BrowserRenderer from "@/pages/Servers/components/ViewContainer/renderer/BrowserRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import Loading from "@/common/components/Loading";
import TitleBar from "@/common/components/TitleBar";
import { isTauri } from "@/common/utils/TauriUtil.js";
import { notifyPopoutClosed, onForceClose } from "@/common/utils/PopoutUtil.js";

const noop = () => {};

export const Popout = () => {
    const { sessionId, monitor } = useParams();
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const refs = useRef({});
    const [controls, setControls] = useState(null);
    const [fullscreenEnabled, setFullscreenEnabled] = useState(false);

    useEffect(() => {
        const sync = () => setFullscreenEnabled(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", sync);
        return () => document.removeEventListener("fullscreenchange", sync);
    }, []);
    const isConnectorMode = isTauri();

    const parsedMonitor = Number.parseInt(monitor, 10);
    const pinnedMonitor = Number.isInteger(parsedMonitor) && parsedMonitor >= 0 ? parsedMonitor : null;

    const titleOf = (name) => pinnedMonitor === null
        ? name : `${name} - ${t("servers.monitors.title", { number: pinnedMonitor + 1 })}`;

    useEffect(() => {
        if (!sessionId || !user) return;
        getRequest(`/connections/${sessionId}`)
            .then(data => {
                setSession(data);
                if (data.server?.name) document.title = `${titleOf(data.server.name)} - Nexterm`;
            })
            .finally(() => setLoading(false));
    }, [sessionId, user, pinnedMonitor]);

    useEffect(() => {
        if (isConnectorMode) return;
        const cleanup = () => notifyPopoutClosed(sessionId, pinnedMonitor);
        window.addEventListener("beforeunload", cleanup);
        return () => window.removeEventListener("beforeunload", cleanup);
    }, [sessionId, isConnectorMode, pinnedMonitor]);

    useEffect(() => onForceClose(() => window.close()), []);

    if (loading) return <Loading />;
    if (!session || session.error) return null;

    const renderer = session.type || session.server?.renderer;
    const closeWindow = () => window.close();
    const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

    return (
        <div className="popout-container">
            {isConnectorMode && <TitleBar title={titleOf(session.server?.name || "Session")} />}
            {renderer === "guac" && (
                <>
                    <SessionOverlayBar session={session} controls={controls}
                                       fullscreenEnabled={fullscreenEnabled} onFullscreenToggle={fullscreen} />
                    <GuacamoleRenderer session={session} disconnectFromServer={closeWindow}
                                       registerGuacamoleRef={noop} onFullscreenToggle={fullscreen} onControlsChange={setControls}
                                       pinnedMonitor={pinnedMonitor} />
                </>
            )}
            {renderer === "web" && <BrowserRenderer session={session} disconnectFromServer={closeWindow}
                                                    registerGuacamoleRef={noop} onFullscreenToggle={fullscreen} />}
            {renderer === "terminal" && <XtermRenderer session={session} disconnectFromServer={closeWindow} registerTerminalRef={noop} broadcastMode={false} terminalRefs={refs} updateProgress={noop} layoutMode="single" onBroadcastToggle={noop} onFullscreenToggle={fullscreen} />}
        </div>
    );
};
