import { mdiServerOutline, mdiCodeBraces, mdiChartBoxOutline, mdiShieldCheckOutline, mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline, mdiShieldAccountOutline, mdiDomain, mdiCreationOutline, mdiKeyVariant, mdiConsole, mdiKeyboardOutline, mdiCloudDownloadOutline, mdiChartLine, mdiHarddisk, mdiFolderOutline, mdiEngine, mdiPalette, mdiShieldKeyOutline, mdiCertificateOutline } from "@mdi/js";
import { lazy } from "react";
import { Permission } from "@/common/utils/permissions.js";

const Account = lazy(() => import("@/pages/Settings/pages/Account"));
const Appearance = lazy(() => import("@/pages/Settings/pages/Appearance"));
const Terminal = lazy(() => import("@/pages/Settings/pages/Terminal"));
const FileManager = lazy(() => import("@/pages/Settings/pages/FileManager"));
const Keymaps = lazy(() => import("@/pages/Settings/pages/Keymaps"));
const Identities = lazy(() => import("@/pages/Settings/pages/Identities"));
const TrustedCertificates = lazy(() => import("@/pages/Settings/pages/TrustedCertificates"));
const Sessions = lazy(() => import("@/pages/Settings/pages/Sessions"));
const Organizations = lazy(() => import("@/pages/Settings/pages/Organizations"));
const Users = lazy(() => import("@/pages/Settings/pages/Users"));
const Authentication = lazy(() => import("@/pages/Settings/pages/Authentication"));
const Sources = lazy(() => import("@/pages/Settings/pages/Sources"));
const Monitoring = lazy(() => import("@/pages/Settings/pages/Monitoring"));
const Backup = lazy(() => import("@/pages/Settings/pages/Backup"));
const AI = lazy(() => import("@/pages/Settings/pages/AI"));
const Engines = lazy(() => import("@/pages/Settings/pages/Engines"));
const Permissions = lazy(() => import("@/pages/Settings/pages/Permissions"));

export const getSidebarNavigation = t => [
    { title: t('common.sidebar.servers'), key: "servers", path: "/servers", icon: mdiServerOutline, toggleEvent: "toggleServerList" },
    { title: t('common.sidebar.monitoring'), key: "monitoring", path: "/monitoring", icon: mdiChartBoxOutline },
    { title: t('common.sidebar.snippets'), key: "snippets", path: "/snippets", icon: mdiCodeBraces },
    { title: t('common.sidebar.audit'), key: "audit", path: "/audit", icon: mdiShieldCheckOutline, permission: Permission.AUDIT_VIEW },
];

export const getSettingsUserPages = t => [
    { title: t("settings.pages.account"), key: "account", icon: mdiAccountCircleOutline, content: <Account /> },
    { title: t("settings.pages.appearance"), key: "appearance", icon: mdiPalette, content: <Appearance /> },
    { title: t("settings.pages.terminal"), key: "terminal", icon: mdiConsole, content: <Terminal /> },
    { title: t("settings.pages.fileManager"), key: "fileManager", icon: mdiFolderOutline, content: <FileManager /> },
    { title: t("settings.pages.keymaps"), key: "keymaps", icon: mdiKeyboardOutline, content: <Keymaps /> },
    { title: t("settings.pages.identities"), key: "identities", icon: mdiKeyVariant, content: <Identities /> },
    { title: t("settings.pages.trustedCertificates"), key: "trustedCertificates", icon: mdiCertificateOutline, content: <TrustedCertificates /> },
    { title: t("settings.pages.sessions"), key: "sessions", icon: mdiClockStarFourPointsOutline, content: <Sessions /> },
    { title: t("settings.pages.organizations"), key: "organizations", icon: mdiDomain, content: <Organizations /> },
];

export const getSettingsAdminPages = t => [
    { title: t("settings.pages.users"), key: "users", icon: mdiAccountGroup, permission: Permission.USERS_VIEW, content: <Users /> },
    { title: t("settings.pages.permissions"), key: "permissions", icon: mdiShieldKeyOutline, permission: Permission.PERMISSIONS_MANAGE, content: <Permissions /> },
    { title: t("settings.pages.authentication"), key: "authentication", icon: mdiShieldAccountOutline, permission: Permission.SETTINGS_AUTH_PROVIDERS, content: <Authentication /> },
    { title: t("settings.pages.sources"), key: "sources", icon: mdiCloudDownloadOutline, permission: Permission.SETTINGS_SOURCES, content: <Sources /> },
    { title: t("settings.pages.monitoring"), key: "monitoring", icon: mdiChartLine, permission: Permission.SETTINGS_MONITORING, content: <Monitoring /> },
    { title: t("settings.pages.engines"), key: "engines", icon: mdiEngine, permission: Permission.SETTINGS_ENGINES, content: <Engines /> },
    { title: t("settings.pages.backup"), key: "backup", icon: mdiHarddisk, permission: Permission.SETTINGS_BACKUP, content: <Backup /> },
    { title: t("settings.pages.ai"), key: "ai", icon: mdiCreationOutline, permission: Permission.SETTINGS_AI, content: <AI /> },
];

export const getAllSettingsPages = t => [...getSettingsUserPages(t), ...getSettingsAdminPages(t)];
