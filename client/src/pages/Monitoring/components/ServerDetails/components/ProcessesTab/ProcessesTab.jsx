import { useState, useMemo } from "react";
import Icon from "@mdi/react";
import { mdiMagnify, mdiConsole, mdiArrowDown, mdiArrowUp } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Tooltip from "@/common/components/Tooltip";
import IconInput from "@/common/components/IconInput";
import EmptyState from "@/common/components/EmptyState";
import { Meter } from "../../../shared";
import "./styles.sass";

const COLUMNS = [
    { key: "command" },
    { key: "cpu", sortable: true },
    { key: "mem", sortable: true },
];

export const ProcessesTab = ({ processList = [] }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("cpu");
    const [sortOrder, setSortOrder] = useState("desc");

    const total = Array.isArray(processList) ? processList.length : 0;

    const processes = useMemo(() => {
        const list = Array.isArray(processList) ? processList : [];
        const query = search.trim().toLowerCase();
        const filtered = query
            ? list.filter(p => p.command?.toLowerCase().includes(query) || p.user?.toLowerCase().includes(query) || String(p.pid).includes(query))
            : list;
        return [...filtered].sort((a, b) => {
            const aVal = a[sortBy] || 0, bVal = b[sortBy] || 0;
            return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
        });
    }, [processList, search, sortBy, sortOrder]);

    const handleSort = (field) => {
        if (sortBy === field) setSortOrder(order => order === "desc" ? "asc" : "desc");
        else { setSortBy(field); setSortOrder("desc"); }
    };

    if (!total) {
        return <EmptyState className="details-empty" icon={mdiConsole} description={t("monitoring.details.processes.noData")} />;
    }

    return (
        <>
            <div className="processes-controls">
                <div className="processes-search">
                    <IconInput type="text" icon={mdiMagnify} placeholder={t("monitoring.details.processes.searchPlaceholder")}
                               value={search} setValue={setSearch} />
                </div>
                <span className="processes-count">{t("monitoring.details.processes.showing", { count: processes.length, total })}</span>
            </div>
            <div className="processes-table">
                <div className="processes-row processes-head">
                    {COLUMNS.map(column => {
                        const label = t(`monitoring.details.processes.columns.${column.key}`);
                        if (!column.sortable) return <span key={column.key} className={`cell cell-${column.key}`}>{label}</span>;
                        const active = sortBy === column.key;
                        return (
                            <button key={column.key} type="button" className={`cell cell-${column.key} sort-btn${active ? " active" : ""}`}
                                    onClick={() => handleSort(column.key)}
                                    aria-sort={active ? (sortOrder === "desc" ? "descending" : "ascending") : undefined}>
                                {label}
                                {active && <Icon path={sortOrder === "desc" ? mdiArrowDown : mdiArrowUp} />}
                            </button>
                        );
                    })}
                </div>
                {processes.length > 0 ? (
                    <div className="processes-body">
                        {processes.map((p, i) => (
                            <div key={`${p.pid}-${i}`} className="processes-row">
                                <div className="cell cell-process">
                                    <Tooltip text={p.command} delay={500} asChild multiline>
                                        <span className="cell-command">{p.command}</span>
                                    </Tooltip>
                                    <span className="cell-meta">{p.user} · PID {p.pid}</span>
                                </div>
                                {["cpu", "mem"].map(stat => (
                                    <span key={stat} className={`cell cell-${stat}`}>
                                        <span className="cell-percent">{(p[stat] ?? 0).toFixed(1)}%</span>
                                        <Meter value={p[stat]} thresholds={false} label={t(`monitoring.details.processes.columns.${stat}`)} />
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : <EmptyState compact icon={mdiMagnify} description={t("monitoring.details.processes.noResults")} />}
            </div>
        </>
    );
};
