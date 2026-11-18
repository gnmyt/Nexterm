import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import { ContextMenu, ContextMenuItem } from "@/common/components/ContextMenu";
import { getIconPath } from "@/common/utils/iconUtils.js";
import { protocolLabel } from "../../utils.js";
import "./styles.sass";

export const ServerMenu = ({ menu, allServers, allowedIds, onToggle }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (!menu.isOpen) return;
        setQuery("");
        const timer = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(timer);
    }, [menu.isOpen]);

    const needle = query.trim().toLowerCase();
    const matches = allServers
        .filter((server) => !needle || `${server.name} ${server.path} ${server.protocol}`.toLowerCase().includes(needle))
        .slice(0, 40);

    const handleSearchKeyDown = (e) => {
        if (e.key === "Enter" && matches.length > 0) {
            e.preventDefault();
            onToggle(matches[0].id);
            menu.close();
        }
    };

    return (
        <ContextMenu isOpen={menu.isOpen} position={menu.position} onClose={menu.close} trigger={menu.triggerRef}
                     placement="above" className="ai-server-menu">
            <div className="ai-server-menu-search">
                <Icon path={mdiMagnify} />
                <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck="false"
                       onKeyDown={handleSearchKeyDown} placeholder={t("servers.aiAssistant.searchServers")}
                       aria-label={t("servers.aiAssistant.searchServers")} />
            </div>
            <div className="ai-server-menu-list">
                {matches.length === 0 && <p className="ai-server-menu-empty">{t("servers.aiAssistant.noMatches")}</p>}
                {matches.map((server) => (
                    <ContextMenuItem key={server.id} keepOpen checked={allowedIds.includes(server.id)}
                                     icon={<Icon path={getIconPath(server.icon)} />}
                                     onClick={() => onToggle(server.id)} label={server.name}
                                     description={[protocolLabel(server.protocol), server.path].filter(Boolean).join(" · ")} />
                ))}
            </div>
        </ContextMenu>
    );
};
