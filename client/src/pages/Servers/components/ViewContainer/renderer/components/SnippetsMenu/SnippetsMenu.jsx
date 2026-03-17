import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import { mdiMagnify, mdiCloudDownloadOutline, mdiLinux } from "@mdi/js";
import Icon from "@mdi/react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { parseOsFilter, matchesOsFilter, normalizeOsName } from "@/common/utils/osUtils.js";

export const SnippetsMenu = ({ onSelect, onClose, visible, activeSession }) => {
    const { allSnippets } = useSnippets();
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sourceSnippets, setSourceSnippets] = useState([]);
    const searchRef = useRef(null);
    const menuRef = useRef(null);
    const snippetRefs = useRef([]);

    const serverOsName = normalizeOsName(activeSession?.osName);
    const isPveEntry = activeSession?.server?.type?.startsWith('pve-');

    useEffect(() => {
        const fetchSourceSnippets = async () => {
            try {
                const data = await getRequest("snippets/sources");
                setSourceSnippets(data || []);
            } catch (error) {
                console.debug("Source snippets not available", error);
            }
        };
        fetchSourceSnippets();
    }, []);

    const availableSnippets = useMemo(() => {
        const userSnippets = allSnippets || [];
        const sessionOrgId = activeSession?.organizationId || null;

        const filteredUserSnippets = userSnippets.filter(snippet =>
            snippet.organizationId === null ||
            (sessionOrgId && snippet.organizationId === sessionOrgId),
        );

        const allAvailable = [...filteredUserSnippets, ...sourceSnippets];
        
        return allAvailable.filter(snippet => matchesOsFilter(snippet.osFilter, serverOsName, isPveEntry));
    }, [allSnippets, activeSession?.organizationId, sourceSnippets, serverOsName, isPveEntry]);

    const filteredSnippets = () => {
        if (!availableSnippets || availableSnippets.length === 0) return [];
        if (!search) return availableSnippets;

        const searchLower = search.toLowerCase();
        return availableSnippets.filter(snippet =>
            snippet.name.toLowerCase().includes(searchLower) ||
            snippet.command.toLowerCase().includes(searchLower) ||
            (snippet.description && snippet.description.toLowerCase().includes(searchLower)),
        );
    };

    const filtered = filteredSnippets();

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            setSearch("");
            setHighlightedIndex(-1);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsPositioned(true);
                    if (searchRef.current) {
                        searchRef.current.focus();
                    }
                });
            });
        } else {
            setIsPositioned(false);
        }
    }, [visible]);

    const handleAnimationEnd = (e) => {
        if (e.target === menuRef.current && !visible) {
            setIsVisible(false);
        }
    };

    const handleSnippetClick = (snippet) => {
        onSelect(snippet.command);
        onClose();
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setHighlightedIndex(-1);
    };

    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }

            if (searchRef.current === document.activeElement) {
                if (e.key === "ArrowDown" && filtered.length > 0) {
                    e.preventDefault();
                    searchRef.current.blur();
                    setHighlightedIndex(0);
                    snippetRefs.current[0]?.focus();
                }
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                const newIndex = highlightedIndex < filtered.length - 1 ? highlightedIndex + 1 : 0;
                setHighlightedIndex(newIndex);
                snippetRefs.current[newIndex]?.focus();
                snippetRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : filtered.length - 1;
                setHighlightedIndex(newIndex);
                snippetRefs.current[newIndex]?.focus();
                snippetRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                e.preventDefault();
                handleSnippetClick(filtered[highlightedIndex]);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [visible, filtered, highlightedIndex, onClose]);

    if (!isVisible) return null;

    const menu = (
        <div className="snippets-menu-overlay" onClick={onClose}>
            <div
                ref={menuRef}
                className={`snippets-menu ${visible && isPositioned ? "open" : "closed"}`}
                onClick={(e) => e.stopPropagation()}
                onTransitionEnd={handleAnimationEnd}
                role="menu"
                aria-orientation="vertical"
            >
                <div className="snippets-menu__search">
                    <Icon path={mdiMagnify} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search snippets..."
                        value={search}
                        onChange={handleSearch}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="snippets-menu__content">
                    {filtered.length === 0 ? (
                        <div className="snippets-menu__no-results">
                            {availableSnippets?.length === 0 ? (
                                <p>No snippets available. Create some in the Snippets section.</p>
                            ) : (
                                <p>No snippets match your search.</p>
                            )}
                        </div>
                    ) : (
                        <div className="snippets-menu__list">
                            {filtered.map((snippet, index) => (
                                <div
                                    key={`${snippet.sourceId ? "source" : "user"}-${snippet.id}`}
                                    ref={(el) => (snippetRefs.current[index] = el)}
                                    className={`snippets-menu__item ${
                                        highlightedIndex === index ? "highlighted" : ""
                                    }`}
                                    onClick={() => handleSnippetClick(snippet)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    role="menuitem"
                                    tabIndex={-1}
                                >
                                    <div className="snippets-menu__item-header">
                                        <h4 className="snippets-menu__item-name">{snippet.name}</h4>
                                        {(() => {
                                            const osFilter = parseOsFilter(snippet.osFilter);
                                            return (
                                                <div className="snippets-menu__item-badges">
                                                    {osFilter.length > 0 && (
                                                        <span className="snippets-menu__os-badge" title={osFilter.join(", ")}>
                                                            <Icon path={mdiLinux} size={0.5} />
                                                            {osFilter.length === 1 ? osFilter[0] : `${osFilter.length} OS`}
                                                        </span>
                                                    )}
                                                    {snippet.sourceId && (
                                                        <Icon path={mdiCloudDownloadOutline} size={0.65}
                                                              className="snippets-menu__source-badge" />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {snippet.description && (
                                        <p className="snippets-menu__item-description">{snippet.description}</p>
                                    )}
                                    <pre className="snippets-menu__item-command">{snippet.command}</pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(menu, document.body);
};