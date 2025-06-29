import "./styles.sass";
import { useState, useEffect } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import MonitoringGrid from "./components/MonitoringGrid";
import ServerDetails from "./components/ServerDetails";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import Icon from "@mdi/react";
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
            <div className="monitoring-header">
                {selectedServer ? (
                    <div className="header-back" onClick={handleBackToGrid}>
                        <Icon path={mdiArrowLeft} />
                        <div className="header-title">
                            <h1>{selectedServer.name}</h1>
                        </div>
                    </div>
                ) : (
                    <div className="header-title">
                        <Icon path={mdiChartBoxOutline} />
                        <div>
                            <h1>Server Monitoring</h1>
                            <p>Real-time server statistics and health monitoring</p>
                        </div>
                    </div>
                )}

                <div className="header-actions">
                    {!selectedServer && <IconInput type="text" icon={mdiMagnify} placeholder="Search servers..."
                                                   value={searchQuery} setValue={handleSearchChange} />}
                </div>
            </div>

            <div className="monitoring-content">
                {selectedServer ? <ServerDetails server={selectedServer} /> :
                    <MonitoringGrid servers={filteredServers} loading={loading} onServerSelect={handleServerSelect} />}
            </div>
        </div>
    );
};
