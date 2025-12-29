import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import * as mdi from "@mdi/js";
import Icon from "@mdi/react";
import { mdiMagnify, mdiClose, mdiChevronDown } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

const getAllIcons = () => {
    const icons = [];
    for (const [name, path] of Object.entries(mdi)) {
        if (name.startsWith("mdi") && typeof path === "string" && path.startsWith("M")) {
            const displayName = name.replace(/^mdi/, "").replace(/([A-Z])/g, " $1").trim().toLowerCase();
            icons.push({ name, displayName, path });
        }
    }
    return icons;
};

const ALL_ICONS = getAllIcons();

const POPULAR_ICON_NAMES = [
    "mdiServerOutline", "mdiMicrosoftWindows", "mdiLinux", "mdiDebian", "mdiUbuntu",
    "mdiFedora", "mdiApple", "mdiDocker", "mdiKubernetes", "mdiDatabase",
    "mdiCloud", "mdiRaspberryPi", "mdiConsole", "mdiMonitor", "mdiCube",
    "mdiFreebsd", "mdiServer", "mdiDesktopClassic", "mdiLaptop", "mdiNas",
    "mdiRouter", "mdiAccessPoint", "mdiWebhook", "mdiApi", "mdiCodeBraces",
    "mdiGit", "mdiGithub", "mdiGitlab", "mdiAws", "mdiMicrosoftAzure",
    "mdiGoogleCloud", "mdiDigitalocean", "mdiCloudflare", "mdiNginx", "mdiRedhat",
    "mdiArchLinux", "mdiCentos", "mdiAlpineLinux", "mdiSuse", "mdiGentoo"
];

const POPULAR_ICONS = POPULAR_ICON_NAMES.map(name => ALL_ICONS.find(icon => icon.name === name)).filter(Boolean);

export const IconChooser = ({ selected, setSelected }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const chooserRef = useRef(null);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    const selectedIcon = useMemo(() => {
        if (!selected) return null;
        return ALL_ICONS.find(icon => icon.name === selected);
    }, [selected]);

    const filteredIcons = useMemo(() => {
        if (!searchTerm) return POPULAR_ICONS;
        const term = searchTerm.toLowerCase();
        return ALL_ICONS.filter(icon => icon.displayName.includes(term)).slice(0, 100);
    }, [searchTerm]);

    const handleIconSelect = useCallback((icon) => {
        setSelected(icon.name);
        setSearchTerm("");
        setIsOpen(false);
    }, [setSelected]);

    useEffect(() => {
        if (!isOpen || !chooserRef.current) {
            setIsPositioned(false);
            setSearchTerm("");
            return;
        }

        const rect = chooserRef.current.getBoundingClientRect();
        let top = rect.bottom + 5;
        let left = rect.left;
        const width = Math.max(320, rect.width);

        requestAnimationFrame(() => {
            if (!dropdownRef.current) return;
            const menuRect = dropdownRef.current.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;

            if (left + menuRect.width > innerWidth - 10) left = innerWidth - menuRect.width - 10;
            if (left < 10) left = 10;
            if (top + menuRect.height > innerHeight - 10) {
                const topPos = rect.top - menuRect.height - 5;
                top = topPos >= 10 ? topPos : innerHeight - menuRect.height - 10;
            }
            if (top < 10) top = 10;

            setPosition({ top, left, width });
            setIsPositioned(true);
        });
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && isPositioned && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, isPositioned]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (!chooserRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        document.addEventListener("click", handleClickOutside, true);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("click", handleClickOutside, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="icon-chooser" ref={chooserRef}>
            <div className="icon-chooser__trigger" onClick={() => setIsOpen(!isOpen)}>
                <Icon path={selectedIcon?.path || mdi.mdiServerOutline} size={1} />
                <Icon path={mdiChevronDown} size={0.8} className="icon-chooser__chevron" />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className={`icon-chooser__dropdown ${isPositioned ? "open" : ""}`}
                    style={{ top: position.top, left: position.left, minWidth: position.width }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="icon-chooser__search">
                        <Icon path={mdiMagnify} size={0.8} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={t("common.iconChooser.searchIcons", "Search icons...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="icon-chooser__clear" onClick={() => setSearchTerm("")}>
                                <Icon path={mdiClose} size={0.7} />
                            </button>
                        )}
                    </div>
                    
                    <div className="icon-chooser__label">
                        {searchTerm 
                            ? `${t("common.iconChooser.searchResults", "Search Results")} (${filteredIcons.length})`
                            : t("common.iconChooser.popularIcons", "Popular Icons")
                        }
                    </div>

                    <div className="icon-chooser__grid">
                        {filteredIcons.length > 0 ? (
                            filteredIcons.map((icon) => (
                                <div
                                    key={icon.name}
                                    className={`icon-chooser__item ${selectedIcon?.name === icon.name ? "selected" : ""}`}
                                    onClick={() => handleIconSelect(icon)}
                                    title={icon.displayName}
                                >
                                    <Icon path={icon.path} size={1} />
                                </div>
                            ))
                        ) : (
                            <div className="icon-chooser__empty">
                                {t("common.iconChooser.noResults", "No icons found")}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
