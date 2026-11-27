import { createPortal } from "react-dom";
import { useContext, useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose, mdiLogout, mdiMagnify } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { getSettingsUserPages, getSettingsAdminPages } from "@/common/utils/navigationConfig.jsx";
import { useScrollSpy } from "@/common/hooks/useScrollSpy.js";
import { SettingsSectionsContext } from "./SettingsHeading.jsx";
import "./styles.sass";
import { isDemoGuest } from "@/common/utils/demo.js";
import { useServerVersion } from "@/common/hooks/useServerVersion.js";

const byDocumentOrder = (a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

const useSections = () => {
    const [sections, setSections] = useState([]);

    const registry = useMemo(() => ({
        update: (id, element) => {
            const label = element.textContent.trim();
            setSections(prev => {
                const known = prev.find(section => section.id === id);
                if (known?.label === label && known.element === element) return prev;
                return [...prev.filter(section => section.id !== id), { id, label, element }].sort(byDocumentOrder);
            });
        },
        remove: (id) => setSections(prev => prev.filter(section => section.id !== id)),
    }), []);

    const labelled = useMemo(() => sections.filter(section => section.label), [sections]);
    return [labelled, registry];
};

export const SettingsDialog = ({ open, onClose, initialTab = "account" }) => {
    const { t } = useTranslation();
    const { user, logout, hasPermission } = useContext(UserContext);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [body, setBody] = useState(null);
    const version = useServerVersion(open);

    const userPages = useMemo(() => getSettingsUserPages(t), [t]);
    const adminPages = useMemo(
        () => getSettingsAdminPages(t).filter(p => !p.permission || hasPermission(p.permission)),
        [t, user],
    );

    const allPages = [...userPages, ...adminPages];
    const currentPage = allPages.find(p => p.key === activeTab) || userPages[0];
    const handleClose = useCallback(() => setIsClosing(true), []);
    const [sections, sectionRegistry] = useSections();
    const sectionIds = useMemo(() => sections.map(section => section.id), [sections]);
    const [activeSection, scrollToSection] = useScrollSpy(body, sectionIds, { threshold: 72, offset: 16 });

    const matches = (page) => !query || page.title.toLowerCase().includes(query.trim().toLowerCase());
    const visibleUser = userPages.filter(matches);
    const visibleAdmin = adminPages.filter(matches);

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
            setIsVisible(true);
            setIsClosing(false);
            setQuery("");
        } else if (isVisible) setIsClosing(true);
    }, [open, initialTab]);

    useEffect(() => {
        if (body) body.scrollTop = 0;
    }, [body, activeTab]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, handleClose]);

    const handleAnimationEnd = () => {
        if (isClosing) {
            setIsVisible(false);
            setIsClosing(false);
            onClose();
        }
    };

    const selectPage = (key) => {
        setActiveTab(key);
        setQuery("");
    };

    const renderNavItem = (page) => {
        const active = currentPage.key === page.key;
        return (
            <div key={page.key} className="nav-entry">
                <button type="button" className={`nav-item${active ? " active" : ""}`} onClick={() => selectPage(page.key)}
                        aria-current={active ? "page" : undefined}>
                    <Icon path={page.icon} className="nav-icon" />
                    <span className="nav-label">{page.title}</span>
                </button>
                {active && !query && sections.length > 1 && (
                    <div className="nav-sections">
                        <div className="nav-sections-inner">
                            {sections.map(section => (
                                <button type="button" key={section.id}
                                        className={`nav-section${activeSection === section.id ? " active" : ""}`}
                                        onClick={() => scrollToSection(section.id)}>
                                    {section.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (!isVisible) return null;

    return createPortal(
        <>
            <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                                 text={isDemoGuest(user) ? t("common.demo.endConfirmText") : t("common.sidebar.logoutConfirmText", { username: user?.username })}
                                 onConfirm={logout} />
            <div className={`settings-dialog-overlay ${isClosing ? "closing" : ""}`} onAnimationEnd={handleAnimationEnd}>
                <div className="settings-dialog">
                    <aside className="settings-dialog-sidebar">
                        <div className="settings-search">
                            <Icon path={mdiMagnify} />
                            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                                   placeholder={t("settings.search")} aria-label={t("settings.search")} />
                        </div>
                        <nav className="settings-dialog-nav">
                            {visibleUser.length > 0 && (
                                <div className="nav-group">
                                    <p className="nav-section-title">{t("settings.userSettings")}</p>
                                    {visibleUser.map(renderNavItem)}
                                </div>
                            )}
                            {visibleAdmin.length > 0 && (
                                <div className="nav-group">
                                    <p className="nav-section-title">{t("settings.adminSettings")}</p>
                                    {visibleAdmin.map(renderNavItem)}
                                </div>
                            )}
                            {visibleUser.length === 0 && visibleAdmin.length === 0 && (
                                <p className="nav-empty">{t("common.table.noData.title")}</p>
                            )}
                            {!query && (
                                <div className="nav-group nav-group--footer">
                                    <button type="button" className="nav-item danger" onClick={() => setLogoutDialogOpen(true)}>
                                        <Icon path={mdiLogout} className="nav-icon" />
                                        <span className="nav-label">{isDemoGuest(user) ? t("common.demo.end") : t("common.sidebar.logout")}</span>
                                    </button>
                                    {version && <span className="nav-version">v{version}</span>}
                                </div>
                            )}
                        </nav>
                    </aside>

                    <section className="settings-dialog-content">
                        <header className="settings-dialog-header">
                            <Icon path={currentPage.icon} className="header-icon" />
                            <h1>{currentPage.title}</h1>
                            <button type="button" className="settings-dialog-close" onClick={handleClose} aria-label={t("common.actions.close")}>
                                <Icon path={mdiClose} />
                            </button>
                        </header>
                        <div className="settings-dialog-body" ref={setBody}>
                            <SettingsSectionsContext.Provider value={sectionRegistry}>
                                <div className="settings-dialog-page" key={currentPage.key}><Suspense fallback={null}>{currentPage.content}</Suspense></div>
                            </SettingsSectionsContext.Provider>
                        </div>
                    </section>
                </div>
            </div>
        </>,
        document.body,
    );
};

export default SettingsDialog;
