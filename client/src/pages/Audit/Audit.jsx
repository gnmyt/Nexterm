import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";
import {
    mdiShieldCheckOutline,
    mdiDomain,
    mdiAccountCircleOutline,
    mdiServerNetworkOutline,
    mdiFileDocumentOutline,
    mdiKeyVariant,
} from "@mdi/js";
import PageHeader from "@/common/components/PageHeader/index.js";
import AuditTable from "./components/AuditTable/index.js";
import AuditFilters from "./components/AuditFilters/index.js";
import "./styles.sass";

export const Audit = () => {
    const { sendToast } = useToast();
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [filters, setFilters] = useState({
        organizationId: null,
        action: "",
        resource: "",
        startDate: "",
        endDate: "",
        limit: 50,
        offset: 0,
    });
    const [total, setTotal] = useState(0);

    const pagination = useMemo(() => ({
        total,
        currentPage: Math.floor(filters.offset / filters.limit) + 1,
        itemsPerPage: filters.limit,
    }), [total, filters.offset, filters.limit]);

    const fetchData = useCallback(async () => {
        try {
            const [metadataRes, orgsRes] = await Promise.all([
                getRequest("audit/metadata"),
                getRequest("organizations"),
            ]);
            setMetadata(metadataRes);
            setOrganizations(orgsRes);
        } catch (error) {
            sendToast("Error", "Failed to load audit data");
        }
    }, [sendToast]);

    const fetchAuditLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(
                Object.entries(filters).filter(([_, value]) => value !== "" && value !== null)
                    .map(([key, value]) => [key, String(value)]),
            );

            const response = await getRequest(`audit/logs?${params}`);
            setAuditLogs(response.logs);
            setTotal(response.total);
        } catch (error) {
            sendToast("Error", "Failed to load audit logs");
            setAuditLogs([]);
        } finally {
            setLoading(false);
        }
    }, [filters, sendToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    const handleFilterChange = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
    }, []);

    const handlePageChange = useCallback((page) => {
        setFilters(prev => ({ ...prev, offset: (page - 1) * prev.limit }));
    }, []);

    const getIconForAction = useCallback((action) => {
        if (action.startsWith("user.")) return mdiAccountCircleOutline;
        if (action.startsWith("server.")) return mdiServerNetworkOutline;
        if (action.startsWith("file.")) return mdiFileDocumentOutline;
        if (action.startsWith("identity.")) return mdiKeyVariant;
        if (action.startsWith("organization.")) return mdiDomain;
        return mdiShieldCheckOutline;
    }, []);

    return (
        <div className="audit-page">
            <PageHeader icon={mdiShieldCheckOutline} title="Audit Logs"
                        subtitle="Track and monitor all activities across your infrastructure" />
            <div className="audit-content">
                <AuditFilters filters={filters} metadata={metadata} organizations={organizations}
                              onChange={handleFilterChange} />
                <AuditTable logs={auditLogs} loading={loading} pagination={pagination} onPageChange={handlePageChange}
                            getIconForAction={getIconForAction} />
            </div>
        </div>
    );
};
