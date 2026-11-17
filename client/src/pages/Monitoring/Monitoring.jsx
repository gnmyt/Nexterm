import "./styles.sass";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest } from "@/common/utils/RequestUtil.js";
import MonitoringGrid from "./components/MonitoringGrid";
import ServerDetails from "./components/ServerDetails";
import { LoadFailedState, getMonitoringState } from "./components/shared";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import PageHeader from "@/common/components/PageHeader";
import { mdiChartBoxOutline, mdiMagnify } from "@mdi/js";
import IconInput from "@/common/components/IconInput";
import Chip from "@/common/components/Chip";
import { useTranslation } from "react-i18next";
import { Page, PageContent, PageToolbar } from "@/common/components/Page";

const FILTERS = ["all", "online", "issues"];

export const Monitoring = () => {
    const { t } = useTranslation();
    const { serverId, tab } = useParams();
    const navigate = useNavigate();
    const { sendToast } = useToast();

    const [servers, setServers] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const hasDataRef = useRef(false);

    const loadMonitoringData = useCallback(async () => {
        try {
            const response = await getRequest("monitoring");
            setServers([...response].sort((a, b) => String(a.id).localeCompare(String(b.id))));
            setLoadFailed(false);
            hasDataRef.current = true;
        } catch {
            setLoadFailed(true);
            if (hasDataRef.current) sendToast(t("monitoring.errors.loadFailed"), "error");
        }
    }, [sendToast, t]);

    useEffect(() => {
        loadMonitoringData();
        const interval = setInterval(loadMonitoringData, 15000);
        return () => clearInterval(interval);
    }, [loadMonitoringData]);

    const selectedServer = useMemo(
        () => serverId ? servers?.find(server => String(server.id) === serverId) || null : null,
        [serverId, servers],
    );

    const closePanel = useCallback(() => navigate("/monitoring"), [navigate]);

    useEffect(() => {
        if (!selectedServer) return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !event.defaultPrevented) closePanel();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedServer, closePanel]);

    const handleServerSelect = (server) => {
        if (String(server.id) === serverId) return closePanel();
        navigate(`/monitoring/${server.id}/${tab || "overview"}`);
    };

    const handleTabChange = (newTab) => {
        if (selectedServer) navigate(`/monitoring/${selectedServer.id}/${newTab}`);
    };

    const counts = useMemo(() => {
        const online = (servers || []).filter(server => getMonitoringState(server) === "online").length;
        return { all: servers?.length || 0, online, issues: (servers?.length || 0) - online };
    }, [servers]);

    const query = searchQuery.trim().toLowerCase();
    const filteredServers = (servers || []).filter(server => {
        if (filter !== "all" && (getMonitoringState(server) === "online") !== (filter === "online")) return false;
        return !query || server.name?.toLowerCase().includes(query) || server.ip?.toLowerCase().includes(query);
    });

    const renderGrid = () => {
        if (servers === null) {
            if (!loadFailed) return null;
            return <div className="monitoring-grid empty"><LoadFailedState onRetry={loadMonitoringData} /></div>;
        }
        return <MonitoringGrid servers={filteredServers} selectedId={selectedServer?.id}
                               isFiltered={servers.length > 0} onServerSelect={handleServerSelect} />;
    };

    return (
        <Page className={`monitoring-page${selectedServer ? " monitoring-page--panel-open" : ""}`}>
            <div className="monitoring-main">
                <PageHeader icon={mdiChartBoxOutline} title={t("monitoring.page.title")} subtitle={t("monitoring.page.subtitle")}>
                    <IconInput type="text" icon={mdiMagnify} placeholder={t("monitoring.page.searchPlaceholder")}
                               value={searchQuery} setValue={setSearchQuery} />
                </PageHeader>
                {servers?.length > 0 && (
                    <PageToolbar className="monitoring-filters">
                        <div className="monitoring-filters__chips">
                            {FILTERS.map(key => (
                                <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}
                                      label={t(`monitoring.page.filters.${key}`, { count: counts[key] })} />
                            ))}
                        </div>
                    </PageToolbar>
                )}
                <PageContent>{renderGrid()}</PageContent>
            </div>
            {selectedServer && (
                <aside className="monitoring-panel">
                    <ServerDetails key={selectedServer.id} server={selectedServer} state={getMonitoringState(selectedServer)}
                                   activeTab={tab || "overview"} onTabChange={handleTabChange} onClose={closePanel} />
                </aside>
            )}
        </Page>
    );
};
