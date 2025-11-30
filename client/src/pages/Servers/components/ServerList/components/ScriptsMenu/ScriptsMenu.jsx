import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import { mdiMagnify, mdiScript, mdiAccountCircle, mdiCloudDownloadOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const ScriptsMenu = ({
                                visible,
                                onClose,
                                scripts = [],
                                server,
                                serverOrganizationId = null,
                                onRunScript,
                                getIdentityName,
                            }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [selectedScript, setSelectedScript] = useState(null);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sourceScripts, setSourceScripts] = useState([]);
    const searchRef = useRef(null);
    const menuRef = useRef(null);
    const scriptRefs = useRef([]);

    useEffect(() => {
        const fetchSourceScripts = async () => {
            try {
                const data = await getRequest("scripts/sources");
                setSourceScripts(data || []);
            } catch (error) {
                console.debug("Source scripts not available", error);
            }
        };
        fetchSourceScripts();
    }, []);

    const availableScripts = useMemo(() => {
        const userScripts = scripts || [];

        const filteredUserScripts = userScripts.filter(script =>
            script.organizationId === null ||
            (serverOrganizationId && script.organizationId === serverOrganizationId),
        );

        return [...filteredUserScripts, ...sourceScripts];
    }, [scripts, serverOrganizationId, sourceScripts]);

    const filteredScripts = useMemo(() => {
        if (!availableScripts || availableScripts.length === 0) return [];
        if (!search) return availableScripts;

        const searchLower = search.toLowerCase();
        return availableScripts.filter(script =>
            script.name.toLowerCase().includes(searchLower) ||
            (script.description && script.description.toLowerCase().includes(searchLower)),
        );
    }, [availableScripts, search]);

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            setSearch("");
            setHighlightedIndex(-1);
            setSelectedScript(null);
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

    const handleScriptClick = (script) => {
        if (server?.identities?.length === 1) {
            onRunScript(server.id, server.identities[0], script.id);
            onClose();
        } else if (server?.identities?.length > 1) {
            setSelectedScript(script);
        }
    };

    const handleIdentityClick = (identityId) => {
        if (selectedScript) {
            onRunScript(server.id, identityId, selectedScript.id);
            onClose();
        }
    };

    const handleBack = () => {
        setSelectedScript(null);
        setHighlightedIndex(-1);
        if (searchRef.current) {
            searchRef.current.focus();
        }
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
                if (selectedScript) {
                    handleBack();
                } else {
                    onClose();
                }
                return;
            }

            const items = selectedScript ? server?.identities || [] : filteredScripts;

            if (searchRef.current === document.activeElement && !selectedScript) {
                if (e.key === "ArrowDown" && items.length > 0) {
                    e.preventDefault();
                    searchRef.current.blur();
                    setHighlightedIndex(0);
                    scriptRefs.current[0]?.focus();
                }
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                const newIndex = highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0;
                setHighlightedIndex(newIndex);
                scriptRefs.current[newIndex]?.focus();
                scriptRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1;
                setHighlightedIndex(newIndex);
                scriptRefs.current[newIndex]?.focus();
                scriptRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < items.length) {
                e.preventDefault();
                if (selectedScript) {
                    handleIdentityClick(items[highlightedIndex]);
                } else {
                    handleScriptClick(items[highlightedIndex]);
                }
            } else if (e.key === "Backspace" && selectedScript && !search) {
                e.preventDefault();
                handleBack();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [visible, filteredScripts, highlightedIndex, onClose, selectedScript, server?.identities]);

    if (!isVisible) return null;

    const menu = (
        <div className="scripts-menu-overlay" onClick={onClose}>
            <div
                ref={menuRef}
                className={`scripts-menu ${visible && isPositioned ? "open" : "closed"}`}
                onClick={(e) => e.stopPropagation()}
                onTransitionEnd={handleAnimationEnd}
                role="menu"
                aria-orientation="vertical"
            >
                {!selectedScript ? (
                    <>
                        <div className="scripts-menu__header">
                            <div className="scripts-menu__title">
                                <Icon path={mdiScript} />
                                <span>{t("servers.contextMenu.runScript")}</span>
                            </div>
                            <div className="scripts-menu__server-info">
                                {server?.name}
                            </div>
                        </div>
                        <div className="scripts-menu__search">
                            <Icon path={mdiMagnify} />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t("scripts.menu.searchPlaceholder", "Search scripts...")}
                                value={search}
                                onChange={handleSearch}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="scripts-menu__content">
                            {filteredScripts.length === 0 ? (
                                <div className="scripts-menu__no-results">
                                    {availableScripts.length === 0 ? (
                                        <p>{t("scripts.menu.noScripts", "No scripts available. Create some in the Scripts section.")}</p>
                                    ) : (
                                        <p>{t("scripts.menu.noMatch", "No scripts match your search.")}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="scripts-menu__list">
                                    {filteredScripts.map((script, index) => (
                                        <div
                                            key={`${script.sourceId ? "source" : "user"}-${script.id}`}
                                            ref={(el) => (scriptRefs.current[index] = el)}
                                            className={`scripts-menu__item ${
                                                highlightedIndex === index ? "highlighted" : ""
                                            }`}
                                            onClick={() => handleScriptClick(script)}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            role="menuitem"
                                            tabIndex={-1}
                                        >
                                            <div className="scripts-menu__item-header">
                                                <h4 className="scripts-menu__item-name">{script.name}</h4>
                                                {script.sourceId && (
                                                    <Icon path={mdiCloudDownloadOutline} size={0.65}
                                                          className="scripts-menu__source-badge" />
                                                )}
                                            </div>
                                            {script.description && (
                                                <p className="scripts-menu__item-description">{script.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="scripts-menu__header">
                            <div className="scripts-menu__title">
                                <Icon path={mdiAccountCircle} />
                                <span>{t("scripts.menu.selectIdentity", "Select Identity")}</span>
                            </div>
                            <div className="scripts-menu__script-info">
                                <button className="scripts-menu__back" onClick={handleBack}>
                                    ← {t("common.actions.back", "Back")}
                                </button>
                                <span className="scripts-menu__script-name">{selectedScript.name}</span>
                            </div>
                        </div>

                        <div className="scripts-menu__content">
                            <div className="scripts-menu__list">
                                {server?.identities?.map((identityId, index) => (
                                    <div
                                        key={identityId}
                                        ref={(el) => (scriptRefs.current[index] = el)}
                                        className={`scripts-menu__item scripts-menu__item--identity ${
                                            highlightedIndex === index ? "highlighted" : ""
                                        }`}
                                        onClick={() => handleIdentityClick(identityId)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        role="menuitem"
                                        tabIndex={-1}
                                    >
                                        <Icon path={mdiAccountCircle} className="scripts-menu__item-icon" />
                                        <span className="scripts-menu__item-name">{getIdentityName(identityId)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(menu, document.body);
};
