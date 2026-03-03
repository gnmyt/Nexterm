import { useEffect, useRef, useState, useCallback, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiServer, mdiCodeTags } from "@mdi/js";
import Fuse from "fuse.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { SnippetContext } from "@/common/contexts/SnippetContext.jsx";
import { getSidebarNavigation, getAllSettingsPages } from "@/common/utils/navigationConfig.jsx";
import "./styles.sass";

export const QuickAction = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { servers } = useContext(ServerContext);
    const { allSnippets } = useContext(SnippetContext);
    const navigate = useNavigate();
    const inputRef = useRef(null), containerRef = useRef(null);
    const isKeyboardNav = useRef(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const flattenServers = (entries, path = []) => (entries || []).flatMap(entry =>
        entry.type === "folder" || entry.type === "organization" ? flattenServers(entry.entries, [...path, entry.name])
        : entry.type === "server" || entry.type?.startsWith("pve-") ? [{ id: `server-${entry.id}`, type: "server", name: entry.name, path: path.join(" / "), icon: mdiServer, data: entry, protocol: entry.protocol || entry.type }] : []
    );

    const allItems = useMemo(() => [
        ...flattenServers(servers),
        ...(allSnippets || []).map(snippet => ({ id: `snippet-${snippet.id}`, type: "snippet", name: snippet.name, path: snippet.description || "", icon: mdiCodeTags, data: snippet })),
        ...getSidebarNavigation(t).map(nav => ({ id: `nav-${nav.path.slice(1)}`, type: "navigation", name: nav.title, icon: nav.icon, route: nav.path, path: t("common.quickAction.navigation") })),
        ...getAllSettingsPages(t).map(page => ({ id: `settings-${page.key}`, type: "settings", name: page.title, icon: page.icon, settingsTab: page.key, path: t("common.quickAction.settings") }))
    ], [servers, allSnippets, t]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return allItems.slice(0, 10);
        const opts = { keys: ['name'], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 1 };
        let results = new Fuse(allItems, opts).search(searchQuery);
        if (results.length > 0 && results.length < 3) results = new Fuse(allItems, { ...opts, threshold: 0.5 }).search(searchQuery);
        else if (results.length > 20) results = new Fuse(allItems, { ...opts, threshold: 0.2 }).search(searchQuery);
        return results.map(result => result.item).slice(0, 15);
    }, [allItems, searchQuery]);

    useEffect(() => setSelectedIndex(0), [filteredItems]);
    useEffect(() => { if (isOpen) { setIsVisible(true); setIsClosing(false); setSearchQuery(""); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 50); } else if (isVisible) setIsClosing(true); }, [isOpen]);

    const handleSelectItem = useCallback(item => {
        if (item.type === "server") navigate(`/servers?connectId=${item.data.id}`);
        else if (item.type === "settings") window.dispatchEvent(new CustomEvent("openSettings", { detail: { tab: item.settingsTab } }));
        else navigate(item.route || "/snippets");
        onClose();
    }, [navigate, onClose]);

    const handleKeyDown = useCallback(event => {
        if (!isOpen) return;
        const actions = { ArrowDown: () => { isKeyboardNav.current = true; setSelectedIndex(idx => idx < filteredItems.length - 1 ? idx + 1 : 0); }, ArrowUp: () => { isKeyboardNav.current = true; setSelectedIndex(idx => idx > 0 ? idx - 1 : filteredItems.length - 1); }, Enter: () => filteredItems[selectedIndex] && handleSelectItem(filteredItems[selectedIndex]), Escape: onClose };
        if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
    }, [isOpen, filteredItems, selectedIndex, onClose, handleSelectItem]);

    const handleMouseEnter = useCallback(index => { if (!isKeyboardNav.current) setSelectedIndex(index); }, []);
    const handleMouseMove = useCallback(() => { isKeyboardNav.current = false; }, []);

    useEffect(() => { document.addEventListener("keydown", handleKeyDown); return () => document.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);
    useEffect(() => { if (!isOpen) return; const handleClickOutside = event => containerRef.current && !containerRef.current.contains(event.target) && onClose(); document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [isOpen, onClose]);
    useEffect(() => { containerRef.current?.querySelector('.quick-action-item.selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selectedIndex]);

    const typeLabels = { server: t("common.quickAction.types.server"), snippet: t("common.quickAction.types.snippet"), navigation: t("common.quickAction.types.navigation"), settings: t("common.quickAction.types.settings") };
    if (!isVisible) return null;

    return createPortal(
        <div className={`quick-action-overlay ${isClosing ? 'closing' : ''}`}>
            <div ref={containerRef} className={`quick-action-container ${isClosing ? 'closing' : ''}`} onAnimationEnd={() => isClosing && (setIsVisible(false), setIsClosing(false))}>
                <div className="quick-action-search">
                    <input ref={inputRef} type="text" placeholder={t("common.quickAction.placeholder")} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} autoComplete="off" spellCheck="false" />
                    <kbd>ESC</kbd>
                </div>
                <div className="quick-action-results">
                    {filteredItems.length === 0 ? <div className="quick-action-empty">{t("common.quickAction.noResults")}</div> : filteredItems.map((item, index) => (
                        <div key={item.id} className={`quick-action-item ${index === selectedIndex ? 'selected' : ''}`} onClick={() => handleSelectItem(item)} onMouseEnter={() => handleMouseEnter(index)} onMouseMove={handleMouseMove}>
                            <Icon path={item.icon} className="item-icon" />
                            <div className="item-content">
                                <div className="item-name">{item.name}{item.type === "server" && <span className="protocol-badge">{(item.protocol || "SSH").toUpperCase()}</span>}</div>
                                {item.path && <div className="item-path">{item.path}</div>}
                            </div>
                            <span className="item-type">{typeLabels[item.type] || ""}</span>
                        </div>
                    ))}
                </div>
                <div className="quick-action-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> {t("common.quickAction.navigate")}</span>
                    <span><kbd>↵</kbd> {t("common.quickAction.select")}</span>
                    <span><kbd>ESC</kbd> {t("common.quickAction.close")}</span>
                </div>
            </div>
        </div>, document.body
    );
};