import "./styles.sass";
import { useParams, useSearchParams } from "react-router-dom";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getActiveServerUrl } from "@/common/utils/TauriUtil.js";
import Icon from "@mdi/react";
import { mdiPlay, mdiStop, mdiTunnel, mdiLoading, mdiServer, mdiNumeric, mdiAccountCircle } from "@mdi/js";
import SelectBox from "@/common/components/SelectBox";
import IconInput from "@/common/components/IconInput";
import Button from "@/common/components/Button";
import TitleBar from "@/common/components/TitleBar";
import Loading from "@/common/components/Loading";

let tauriInvoke = null;
const getInvoke = async () => {
    if (!tauriInvoke) tauriInvoke = (await import("@tauri-apps/api/core")).invoke;
    return tauriInvoke;
};

export const Tunnel = () => {
    const { t } = useTranslation();
    const { entryId } = useParams();
    const [searchParams] = useSearchParams();
    const serverName = searchParams.get("name") || "Server";
    const { sendToast } = useToast();
    
    const { getServerById, servers } = useContext(ServerContext);
    const { identities } = useContext(IdentityContext);
    const { sessionToken, user } = useContext(UserContext);
    
    const [server, setServer] = useState(null);
    const [selectedIdentityId, setSelectedIdentityId] = useState(null);
    const [remoteHost, setRemoteHost] = useState("127.0.0.1");
    const [remotePort, setRemotePort] = useState("");
    const [localPort, setLocalPort] = useState("");
    const [tunnelStatus, setTunnelStatus] = useState("idle");
    const [tunnelId, setTunnelId] = useState(null);
    const pollRef = useRef(null);
    const tunnelIdRef = useRef(null);

    useEffect(() => {
        if (servers && entryId) setServer(getServerById(entryId));
    }, [servers, entryId, getServerById]);

    useEffect(() => {
        if (server?.identities?.length > 0 && identities?.length > 0 && !selectedIdentityId) {
            setSelectedIdentityId(server.identities[0]);
        }
    }, [server, identities, selectedIdentityId]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearTimeout(pollRef.current);
            if (tunnelIdRef.current) {
                getInvoke().then(invoke => invoke("stop_tunnel", { id: tunnelIdRef.current })).catch(() => {});
            }
        };
    }, []);

    const identityOptions = server?.identities?.map((identityId) => {
        const identity = identities?.find(id => id.id === identityId);
        return { value: identityId, label: identity?.name || `Identity ${identityId}`, icon: mdiAccountCircle };
    }) || [];

    const pollTunnelStatus = useCallback(async (id) => {
        try {
            const invoke = await getInvoke();
            const status = await invoke("get_tunnel_status", { id });
            if (status) {
                setTunnelStatus(status.status);
                if (status.error) sendToast("Error", status.error);
                if (status.status === "listening" || status.status === "starting") {
                    pollRef.current = setTimeout(() => pollTunnelStatus(id), 2000);
                }
            }
        } catch { setTunnelStatus("idle"); }
    }, [sendToast]);

    const startTunnel = async () => {
        if (!remotePort || !localPort || !selectedIdentityId) {
            sendToast("Error", t("tunnel.error.fillAllFields"));
            return;
        }

        setTunnelStatus("starting");

        try {
            const invoke = await getInvoke();
            const id = `tunnel_${entryId}_${Date.now()}`;
            const result = await invoke("start_tunnel", {
                config: {
                    id,
                    server_url: getActiveServerUrl() || window.location.origin,
                    token: sessionToken,
                    entry_id: parseInt(entryId, 10),
                    identity_id: selectedIdentityId,
                    remote_host: remoteHost,
                    remote_port: parseInt(remotePort, 10),
                    local_port: parseInt(localPort, 10),
                }
            });
            setTunnelId(id);
            tunnelIdRef.current = id;
            setTunnelStatus(result.status);
            pollTunnelStatus(id);
        } catch (error) {
            setTunnelStatus("error");
            sendToast("Error", error.toString());
        }
    };

    const stopTunnel = async () => {
        if (!tunnelId) return;
        try {
            const invoke = await getInvoke();
            await invoke("stop_tunnel", { id: tunnelId });
            setTunnelStatus("idle");
            setTunnelId(null);
            tunnelIdRef.current = null;
        } catch (error) {
            sendToast("Error", error.toString());
        }
    };

    const isActive = tunnelStatus === "listening" || tunnelStatus === "starting";
    const isLoading = servers === null || identities === null || !user;

    if (isLoading) return <><TitleBar title={`Port Forward - ${serverName}`} hideMaximize /><Loading /></>;

    return (
        <>
            <TitleBar title={`Port Forward - ${serverName}`} hideMaximize />
            <div className="tunnel-page">
                <div className="tunnel-header">
                    <Icon path={mdiTunnel} size={1} />
                    <h2>{t("tunnel.title")}</h2>
                </div>
                <div className="tunnel-form">
                    <div className="form-group">
                        <label>{t("tunnel.identity")}</label>
                        <SelectBox options={identityOptions} selected={selectedIdentityId} setSelected={setSelectedIdentityId} disabled={isActive} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>{t("tunnel.remoteHost")}</label>
                            <IconInput type="text" icon={mdiServer} value={remoteHost} setValue={setRemoteHost} placeholder="127.0.0.1" disabled={isActive} />
                        </div>
                        <div className="form-group">
                            <label>{t("tunnel.remotePort")}</label>
                            <IconInput type="number" icon={mdiNumeric} value={remotePort} setValue={setRemotePort} placeholder="3306" disabled={isActive} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>{t("tunnel.localPort")}</label>
                        <IconInput type="number" icon={mdiNumeric} value={localPort} setValue={setLocalPort} placeholder="3306" disabled={isActive} />
                    </div>
                    <div className="tunnel-status">
                        <span className={`status-indicator ${tunnelStatus}`}></span>
                        <span className="status-text">
                            {tunnelStatus === "idle" && t("tunnel.status.idle")}
                            {tunnelStatus === "starting" && t("tunnel.status.starting")}
                            {tunnelStatus === "listening" && t("tunnel.status.listening", { port: localPort })}
                            {tunnelStatus === "error" && t("tunnel.status.idle")}
                            {tunnelStatus === "stopped" && t("tunnel.status.stopped")}
                        </span>
                    </div>
                    <div className="tunnel-actions">
                        {!isActive ? (
                            <Button text={t("tunnel.start")} icon={mdiPlay} onClick={startTunnel} type="primary" />
                        ) : (
                            <Button text={t("tunnel.stop")} icon={tunnelStatus === "starting" ? mdiLoading : mdiStop} onClick={stopTunnel} type="error" />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};