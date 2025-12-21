import "./styles.sass";
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiLinkOff, mdiAlertCircle } from "@mdi/js";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import Loading from "@/common/components/Loading";
import { request } from "@/common/utils/RequestUtil";

const noop = () => {};

export const Share = () => {
    const { t } = useTranslation();
    const { shareId } = useParams();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [disconnected, setDisconnected] = useState(false);
    const refs = useRef({});

    const handleDisconnect = () => {
        setDisconnected(true);
        setTimeout(() => window.close(), 100);
    };

    useEffect(() => {
        if (!shareId) return;
        request(`share/${shareId}`, "GET")
            .then(data => {
                setSession({ ...data, shareId });
                if (data.server?.name) document.title = `${data.server.name} (Shared) - Nexterm`;
            })
            .catch(err => setError(err.message || t("share.errors.failedToJoin")))
            .finally(() => setLoading(false));
    }, [shareId, t]);

    if (loading) return <Loading />;
    
    if (error) return (
        <div className="share-state">
            <Icon path={mdiAlertCircle} />
            <h3>{t("share.errors.unableToConnect")}</h3>
            <p>{error}</p>
        </div>
    );
    
    if (disconnected) return (
        <div className="share-state">
            <Icon path={mdiLinkOff} />
            <h3>{t("share.sessionEnded.title")}</h3>
            <p>{t("share.sessionEnded.description")}</p>
        </div>
    );
    
    if (!session) return null;

    const renderer = session.type || session.server?.renderer;
    const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

    return (
        <div className="share-container">
            {renderer === "guac" && <GuacamoleRenderer session={session} disconnectFromServer={handleDisconnect} registerGuacamoleRef={noop} onFullscreenToggle={fullscreen} isShared />}
            {renderer === "terminal" && <XtermRenderer session={session} disconnectFromServer={handleDisconnect} registerTerminalRef={noop} broadcastMode={false} terminalRefs={refs} updateProgress={noop} layoutMode="single" onBroadcastToggle={noop} onFullscreenToggle={fullscreen} isShared />}
        </div>
    );
};
