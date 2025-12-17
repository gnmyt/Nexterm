import "./styles.sass";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest } from "@/common/utils/RequestUtil.js";
import MonitoringGrid from "./components/MonitoringGrid";
import ServerDetails from "./components/ServerDetails";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import PageHeader from "@/common/components/PageHeader";
import { mdiArrowLeft, mdiChartBoxOutline, mdiMagnify } from "@mdi/js";
import IconInput from "@/common/components/IconInput";
import { useTranslation } from "react-i18next";

export const Monitoring = () => {
    const { t } = useTranslation();
    const { serverId, tab } = useParams();
    const navigate = useNavigate();
    const { sendToast } = useToast();
    
    const [servers, setServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const serverIdRef = useRef(serverId);

    useEffect(() => {
        serverIdRef.current = serverId;
    }, [serverId]);

    const loadMonitoringData = useCallback(async () => {
        try {
            const response = await getRequest("monitoring");
            const sorted = [...response].sort((a, b) => String(a.id).localeCompare(String(b.id)));
            setServers(sorted);
            
            const currentServerId = serverIdRef.current;
            if (currentServerId) {
                const server = sorted.find(s => String(s.id) === currentServerId);
                if (server) setSelectedServer(server);
            }
        } catch (error) {
            sendToast(t("monitoring.errors.loadFailed"), "error");
        }
    }, [sendToast, t]);

    useEffect(() => {
        loadMonitoringData();
        const interval = setInterval(loadMonitoringData, 15000);
        return () => clearInterval(interval);
    }, [loadMonitoringData]);

    useEffect(() => {
        if (serverId && servers.length > 0) {
            const server = servers.find(s => String(s.id) === serverId);
            if (server) setSelectedServer(server);
        } else if (!serverId) {
            setSelectedServer(null);
        }
    }, [serverId, servers]);

    const handleServerSelect = (server) => {
        setSelectedServer(server);
        navigate(`/monitoring/${server.id}/overview`);
    };

    const handleBackToGrid = () => {
        setSelectedServer(null);
        navigate("/monitoring");
    };

    const handleTabChange = (newTab) => {
        if (selectedServer) navigate(`/monitoring/${selectedServer.id}/${newTab}`);
    };

    const filteredServers = searchQuery.trim()
        ? servers.filter(s =>
            s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.ip?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : servers;

    return (
        <div className="monitoring-page">
            <PageHeader
                icon={selectedServer ? undefined : mdiChartBoxOutline}
                title={selectedServer ? selectedServer.name : t("monitoring.page.title")}
                subtitle={selectedServer ? undefined : t("monitoring.page.subtitle")}
                onBackClick={selectedServer ? handleBackToGrid : undefined}
                backIcon={mdiArrowLeft}>
                {!selectedServer && (
                    <IconInput type="text" icon={mdiMagnify} placeholder={t("monitoring.page.searchPlaceholder")}
                        value={searchQuery} setValue={setSearchQuery} />
                )}
            </PageHeader>
            <div className="monitoring-content">
                {selectedServer ? (
                    <ServerDetails server={selectedServer} activeTab={tab || "overview"} onTabChange={handleTabChange} />
                ) : (
                    <MonitoringGrid servers={filteredServers} onServerSelect={handleServerSelect} />
                )}
            </div>
        </div>
    );
};
