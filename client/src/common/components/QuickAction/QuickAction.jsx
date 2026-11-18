import { useEffect, useRef, useState, useCallback, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiCodeTags, mdiMagnify, mdiTextSearch } from "@mdi/js";
import Fuse from "fuse.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { SnippetContext } from "@/common/contexts/SnippetContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getSidebarNavigation, getAllSettingsPages } from "@/common/utils/navigationConfig.jsx";
import { getIconPath } from "@/common/utils/iconUtils.js";
import EmptyState from "@/common/components/EmptyState";
import "./styles.sass";

const GROUP_ORDER = ["server", "snippet", "navigation", "settings"];

export const QuickAction = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { servers } = useContext(ServerContext);
    const { allSnippets } = useContext(SnippetContext);
    const { hasPermission } = useContext(UserContext);
    const navigate = useNavigate();
    const inputRef = useRef(null), containerRef = useRef(null);
    const isKeyboardNav = useRef(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const flattenServers = (entries, path = []) => (entries || []).flatMap(entry =>
        entry.type === "folder" || entry.type === "organization" ? flattenServers(entry.entries, [...path, entry.name])
        : entry.type === "server" || entry.type?.startsWith("pve-") ? [{
            id: `server-${entry.id}`, type: "server", name: entry.name, path: path.join(" / "),
            icon: getIconPath(entry.icon), data: entry, protocol: entry.protocol || entry.type,
        }] : []
    );

    const allItems = useMemo(() => [
        ...flattenServers(servers),
        ...(allSnippets || []).map(snippet => ({ id: `snippet-${snippet.id}`, type: "snippet", name: snippet.name, path: snippet.description || "", icon: mdiCodeTags, data: snippet })),
        ...getSidebarNavigation(t).filter(nav => !nav.permission || hasPermission(nav.permission)).map(nav => ({ id: `nav-${nav.path.slice(1)}`, type: "navigation", name: nav.title, icon: nav.icon, route: nav.path })),
        ...getAllSettingsPages(t).filter(page => !page.permission || hasPermission(page.permission)).map(page => ({ id: `settings-${page.key}`, type: "settings", name: page.title, icon: page.icon, settingsTab: page.key })),
    ], [servers, allSnippets, t, hasPermission]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return allItems.slice(0, 10);
        const opts = { keys: ["name"], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 1 };
        let results = new Fuse(allItems, opts).search(searchQuery);
        if (results.length > 0 && results.length < 3) results = new Fuse(allItems, { ...opts, threshold: 0.5 }).search(searchQuery);
        else if (results.length > 20) results = new Fuse(allItems, { ...opts, threshold: 0.2 }).search(searchQuery);
        return results.map(result => result.item).slice(0, 15);
    }, [allItems, searchQuery]);

    const typeLabels = {
        server: t("common.quickAction.types.server"), snippet: t("common.quickAction.types.snippet"),
        navigation: t("common.quickAction.types.navigation"), settings: t("common.quickAction.types.settings"),
    };

    const groups = useMemo(() => GROUP_ORDER
        .map(type => ({ type, items: filteredItems.filter(item => item.type === type) }))
        .filter(group => group.items.length > 0), [filteredItems]);
    const orderedItems = useMemo(() => groups.flatMap(group => group.items), [groups]);

    useEffect(() => setSelectedIndex(0), [orderedItems]);
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            setSearchQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        } else if (isVisible) setIsClosing(true);
    }, [isOpen]);

    const handleSelectItem = useCallback(item => {
        if (item.type === "server") navigate(`/servers?connectId=${item.data.id}`);
        else if (item.type === "settings") window.dispatchEvent(new CustomEvent("openSettings", { detail: { tab: item.settingsTab } }));
        else navigate(item.route || "/snippets");
        onClose();
    }, [navigate, onClose]);

    const handleKeyDown = useCallback(event => {
        if (!isOpen) return;
        const actions = {
            ArrowDown: () => { isKeyboardNav.current = true; setSelectedIndex(idx => idx < orderedItems.length - 1 ? idx + 1 : 0); },
            ArrowUp: () => { isKeyboardNav.current = true; setSelectedIndex(idx => idx > 0 ? idx - 1 : orderedItems.length - 1); },
            Enter: () => orderedItems[selectedIndex] && handleSelectItem(orderedItems[selectedIndex]),
            Escape: onClose,
        };
        if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
    }, [isOpen, orderedItems, selectedIndex, onClose, handleSelectItem]);

    const handleMouseEnter = useCallback(index => { if (!isKeyboardNav.current) setSelectedIndex(index); }, []);
    const handleMouseMove = useCallback(() => { isKeyboardNav.current = false; }, []);

    useEffect(() => { document.addEventListener("keydown", handleKeyDown); return () => document.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = event => containerRef.current && !containerRef.current.contains(event.target) && onClose();
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);
    useEffect(() => { containerRef.current?.querySelector(".quick-action-item.selected")?.scrollIntoView({ block: "nearest" }); }, [selectedIndex]);

    if (!isVisible) return null;

    let runningIndex = 0;

    return createPortal(
        <div className={`quick-action-overlay ${isClosing ? "closing" : ""}`}>
            <div ref={containerRef} className={`quick-action-container ${isClosing ? "closing" : ""}`} role="dialog" aria-modal="true"
                 onAnimationEnd={() => isClosing && (setIsVisible(false), setIsClosing(false))}>
                <div className="quick-action-search">
                    <Icon path={mdiMagnify} className="quick-action-search__icon" />
                    <input ref={inputRef} type="text" placeholder={t("common.quickAction.placeholder")} value={searchQuery}
                           onChange={event => setSearchQuery(event.target.value)} autoComplete="off" spellCheck="false"
                           aria-label={t("common.quickAction.placeholder")} />
                    <kbd>ESC</kbd>
                </div>

                <div className="quick-action-results" role="listbox">
                    {orderedItems.length === 0 ? (
                        <EmptyState compact icon={mdiTextSearch} title={t("common.quickAction.noResults")} className="quick-action-empty" />
                    ) : groups.map(group => (
                        <div key={group.type} className="quick-action-group">
                            <p className="quick-action-group__title">{typeLabels[group.type]}</p>
                            {group.items.map(item => {
                                const index = runningIndex++;
                                const selected = index === selectedIndex;
                                const meta = item.type === "server"
                                    ? [(item.protocol || "ssh").toUpperCase(), item.path].filter(Boolean)
                                    : item.path ? [item.path] : [];
                                return (
                                    <div key={item.id} role="option" aria-selected={selected}
                                         className={`quick-action-item${selected ? " selected" : ""}`}
                                         onClick={() => handleSelectItem(item)} onMouseEnter={() => handleMouseEnter(index)}
                                         onMouseMove={handleMouseMove}>
                                        <span className="item-icon"><Icon path={item.icon} /></span>
                                        <span className="item-content">
                                            <span className="item-name">{item.name}</span>
                                            {meta.length > 0 && (
                                                <span className="item-meta">
                                                    {meta.map((part, i) => <span key={i} className="item-meta__part">{part}</span>)}
                                                </span>
                                            )}
                                        </span>
                                        <kbd className="item-enter" aria-hidden="true">↵</kbd>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="quick-action-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> {t("common.quickAction.navigate")}</span>
                    <span><kbd>↵</kbd> {t("common.quickAction.select")}</span>
                    <span><kbd>ESC</kbd> {t("common.quickAction.close")}</span>
                </div>
            </div>
        </div>, document.body,
    );
};
