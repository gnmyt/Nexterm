import { useState, useMemo } from "react";
import Icon from "@mdi/react";
import { mdiMagnify, mdiConsole, mdiSortAscending, mdiSortDescending } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

const SORT_FIELDS = ["cpu", "mem", "pid"];

export const ProcessesTab = ({ processList = [] }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("cpu");
    const [sortOrder, setSortOrder] = useState("desc");

    const processes = useMemo(() => {
        const list = Array.isArray(processList) ? processList : [];
        const query = search.toLowerCase();
        const filtered = query 
            ? list.filter(p => p.command?.toLowerCase().includes(query) || p.user?.toLowerCase().includes(query) || String(p.pid).includes(query))
            : list;
        return [...filtered].sort((a, b) => {
            const aVal = a[sortBy] || 0, bVal = b[sortBy] || 0;
            return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
        });
    }, [processList, search, sortBy, sortOrder]);

    const handleSort = (field) => {
        if (sortBy === field) setSortOrder(o => o === "desc" ? "asc" : "desc");
        else { setSortBy(field); setSortOrder("desc"); }
    };

    if (!processList?.length) {
        return <div className="processes-tab"><div className="processes-empty"><Icon path={mdiConsole} /><p>{t("monitoring.details.processes.noData")}</p></div></div>;
    }

    return (
        <div className="processes-tab">
            <div className="processes-controls">
                <div className="processes-search">
                    <Icon path={mdiMagnify} />
                    <input type="text" placeholder={t("monitoring.details.processes.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="processes-sort">
                    {SORT_FIELDS.map(f => (
                        <button key={f} className={`sort-btn ${sortBy === f ? "active" : ""}`} onClick={() => handleSort(f)}>
                            {f.toUpperCase()}
                            {sortBy === f && <Icon path={sortOrder === "desc" ? mdiSortDescending : mdiSortAscending} />}
                        </button>
                    ))}
                </div>
            </div>
            <div className="processes-list">
                {processes.map((p, i) => (
                    <div key={`${p.pid}-${i}`} className="process-item">
                        <div className="process-command" title={p.command}>{p.command?.length > 50 ? p.command.slice(0, 50) + "…" : p.command}</div>
                        <div className="process-info"><span className="process-user">{p.user}</span><span className="process-pid">{p.pid}</span></div>
                        <div className="process-stats">
                            {["cpu", "mem"].map(stat => (
                                <div key={stat} className={`stat ${stat}`}>
                                    <div className="stat-bar">
                                        <div className="stat-fill" style={{ width: `${Math.min(p[stat] || 0, 100)}%` }} />
                                        <span>{p[stat]?.toFixed(1)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {!processes.length && search && <div className="processes-empty"><p>{t("monitoring.details.processes.noResults")}</p></div>}
        </div>
    );
};
