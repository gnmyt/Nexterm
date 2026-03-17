import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import { mdiMagnify, mdiScript, mdiAccountCircle, mdiCloudDownloadOutline, mdiEgg } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { matchesOsFilter, normalizeOsName } from "@/common/utils/osUtils.js";

const KONAMI_CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export const ScriptsMenu = ({ visible, onClose, scripts = [], server, serverOrganizationId = null, onRunScript, getIdentityName }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [selectedScript, setSelectedScript] = useState(null);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sourceScripts, setSourceScripts] = useState([]);
    const [showSecrets, setShowSecrets] = useState(false);
    const [serverOsName, setServerOsName] = useState(null);
    const konamiIndexRef = useRef(0);
    const searchRef = useRef(null);
    const menuRef = useRef(null);
    const scriptRefs = useRef([]);

    const isPveEntry = server?.type?.startsWith('pve-');

    useEffect(() => {
        getRequest("scripts/sources").then(setSourceScripts).catch(() => {});
    }, []);

    useEffect(() => {
        if (!visible || !server?.id || isPveEntry) {
            setServerOsName(null);
            return;
        }
        getRequest(`monitoring/${server.id}`)
            .then(data => setServerOsName(normalizeOsName(data?.latest?.osInfo?.name)))
            .catch(() => setServerOsName(null));
    }, [visible, server?.id, isPveEntry]);

    const availableScripts = useMemo(() => {
        const filtered = (scripts || []).filter(s => 
            !s.organizationId || s.organizationId === serverOrganizationId
        );
        const all = [...filtered, ...sourceScripts].map(s => ({
            ...s,
            isSecret: s.name === "???" && s.description === "What happened?",
        }));
        const visible = showSecrets ? all : all.filter(s => !s.isSecret);
        
        return visible.filter(script => matchesOsFilter(script.osFilter, serverOsName, isPveEntry));
    }, [scripts, serverOrganizationId, sourceScripts, showSecrets, isPveEntry, serverOsName]);

    const filteredScripts = useMemo(() => {
        if (!search) return availableScripts;
        const q = search.toLowerCase();
        return availableScripts.filter(s => 
            s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
        );
    }, [availableScripts, search]);

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            setSearch("");
            setHighlightedIndex(-1);
            setSelectedScript(null);
            setShowSecrets(false);
            konamiIndexRef.current = 0;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                setIsPositioned(true);
                searchRef.current?.focus();
            }));
        } else {
            setIsPositioned(false);
        }
    }, [visible]);

    const handleBack = useCallback(() => {
        setSelectedScript(null);
        setHighlightedIndex(-1);
        searchRef.current?.focus();
    }, []);

    const handleScriptClick = useCallback((script) => {
        if (server?.identities?.length === 1) {
            onRunScript(server.id, server.identities[0], script.id);
            onClose();
        } else if (server?.identities?.length > 1) {
            setSelectedScript(script);
        }
    }, [server, onRunScript, onClose]);

    const handleIdentityClick = useCallback((identityId) => {
        if (selectedScript) {
            onRunScript(server.id, identityId, selectedScript.id);
            onClose();
        }
    }, [selectedScript, server, onRunScript, onClose]);

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e) => {
            if (e.key === KONAMI_CODE[konamiIndexRef.current]) {
                konamiIndexRef.current++;
                if (konamiIndexRef.current === KONAMI_CODE.length) {
                    setShowSecrets(true);
                    konamiIndexRef.current = 0;
                }
            } else {
                konamiIndexRef.current = e.key === KONAMI_CODE[0] ? 1 : 0;
            }

            if (e.key === "Escape") {
                e.preventDefault();
                selectedScript ? handleBack() : onClose();
                return;
            }

            const items = selectedScript ? server?.identities || [] : filteredScripts;

            if (searchRef.current === document.activeElement && !selectedScript && e.key === "ArrowDown" && items.length) {
                e.preventDefault();
                searchRef.current.blur();
                setHighlightedIndex(0);
                scriptRefs.current[0]?.focus();
                return;
            }

            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                const newIndex = (highlightedIndex + delta + items.length) % items.length;
                setHighlightedIndex(newIndex);
                scriptRefs.current[newIndex]?.focus();
                scriptRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < items.length) {
                e.preventDefault();
                selectedScript ? handleIdentityClick(items[highlightedIndex]) : handleScriptClick(items[highlightedIndex]);
            } else if (e.key === "Backspace" && selectedScript && !search) {
                e.preventDefault();
                handleBack();
            }
        };

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [visible, filteredScripts, highlightedIndex, onClose, selectedScript, server?.identities, handleBack, handleScriptClick, handleIdentityClick, search]);

    if (!isVisible) return null;

    return createPortal(
        <div className="scripts-menu-overlay" onClick={onClose}>
            <div
                ref={menuRef}
                className={`scripts-menu ${visible && isPositioned ? "open" : "closed"}`}
                onClick={(e) => e.stopPropagation()}
                onTransitionEnd={(e) => e.target === menuRef.current && !visible && setIsVisible(false)}
                role="menu"
            >
                {!selectedScript ? (
                    <>
                        <div className="scripts-menu__header">
                            <div className="scripts-menu__title">
                                <Icon path={mdiScript} />
                                <span>{t("servers.contextMenu.runScript")}</span>
                            </div>
                            <div className="scripts-menu__server-info">{server?.name}</div>
                        </div>
                        <div className="scripts-menu__search">
                            <Icon path={mdiMagnify} />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t("scripts.menu.searchPlaceholder")}
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(-1); }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="scripts-menu__content">
                            {filteredScripts.length === 0 ? (
                                <div className="scripts-menu__no-results">
                                    <p>{availableScripts.length === 0 
                                        ? t("scripts.menu.noScripts")
                                        : t("scripts.menu.noMatch")}</p>
                                </div>
                            ) : (
                                <div className="scripts-menu__list">
                                    {filteredScripts.map((script, index) => (
                                        <div
                                            key={`${script.sourceId ? "source" : "user"}-${script.id}`}
                                            ref={(el) => (scriptRefs.current[index] = el)}
                                            className={`scripts-menu__item ${highlightedIndex === index ? "highlighted" : ""} ${script.isSecret ? "scripts-menu__item--secret" : ""}`}
                                            onClick={() => handleScriptClick(script)}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            role="menuitem"
                                            tabIndex={-1}
                                        >
                                            <div className="scripts-menu__item-header">
                                                <h4 className="scripts-menu__item-name">{script.name}</h4>
                                                {script.isSecret ? (
                                                    <Icon path={mdiEgg} size={0.65} className="scripts-menu__source-badge scripts-menu__source-badge--secret" />
                                                ) : script.sourceId && (
                                                    <Icon path={mdiCloudDownloadOutline} size={0.65} className="scripts-menu__source-badge" />
                                                )}
                                            </div>
                                            {script.description && <p className="scripts-menu__item-description">{script.description}</p>}
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
                                <span>{t("scripts.menu.selectIdentity")}</span>
                            </div>
                            <div className="scripts-menu__script-info">
                                <button className="scripts-menu__back" onClick={handleBack}>← {t("common.actions.back")}</button>
                                <span className="scripts-menu__script-name">{selectedScript.name}</span>
                            </div>
                        </div>
                        <div className="scripts-menu__content">
                            <div className="scripts-menu__list">
                                {server?.identities?.map((identityId, index) => (
                                    <div
                                        key={identityId}
                                        ref={(el) => (scriptRefs.current[index] = el)}
                                        className={`scripts-menu__item scripts-menu__item--identity ${highlightedIndex === index ? "highlighted" : ""}`}
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
        </div>,
        document.body
    );
};
