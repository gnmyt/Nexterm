import "./styles.sass";
import { useState, useEffect } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import MonitoringGrid from "./components/MonitoringGrid";
import ServerDetails from "./components/ServerDetails";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import PageHeader from "@/common/components/PageHeader";
import { mdiArrowLeft, mdiChartBoxOutline, mdiMagnify } from "@mdi/js";
import IconInput from "@/common/components/IconInput";

export const Monitoring = () => {
    const [servers, setServers] = useState([]);
    const [filteredServers, setFilteredServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { sendToast } = useToast();

    const loadMonitoringData = async () => {
        try {
            const response = await getRequest("monitoring");
            setServers(response);
            setFilteredServers(response);
        } catch (error) {
            console.error("Error loading monitoring data:", error);
            sendToast("Failed to load monitoring data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMonitoringData();

        const interval = setInterval(() => {
            loadMonitoringData();
        }, 15000);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredServers(servers);
        } else {
            const filtered = servers.filter(server =>
                server.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.status?.toLowerCase().includes(searchQuery.toLowerCase()),
            );
            setFilteredServers(filtered);
        }
    }, [servers, searchQuery]);

    const handleServerSelect = (server) => setSelectedServer(server);
    const handleBackToGrid = () => setSelectedServer(null);
    const handleSearchChange = (value) => setSearchQuery(value);

    return (
        <div className="monitoring-page">
            <PageHeader
                icon={selectedServer ? undefined : mdiChartBoxOutline}
                title={selectedServer ? selectedServer.name : "Server Monitoring"}
                subtitle={selectedServer ? undefined : "Real-time server statistics and health monitoring"}
                onBackClick={selectedServer ? handleBackToGrid : undefined}
                backIcon={mdiArrowLeft}>
                {!selectedServer && (
                    <IconInput type="text" icon={mdiMagnify} placeholder="Search servers..." value={searchQuery}
                               setValue={handleSearchChange} />
                )}
            </PageHeader>

            <div className="monitoring-content">
                {selectedServer ? <ServerDetails server={selectedServer} /> :
                    <MonitoringGrid servers={filteredServers} loading={loading} onServerSelect={handleServerSelect} />}
            </div>
        </div>
    );
};
