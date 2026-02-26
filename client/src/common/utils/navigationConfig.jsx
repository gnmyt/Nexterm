import { mdiServerOutline, mdiCodeBraces, mdiChartBoxOutline, mdiShieldCheckOutline, mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline, mdiShieldAccountOutline, mdiDomain, mdiCreationOutline, mdiKeyVariant, mdiConsole, mdiKeyboardOutline, mdiCloudDownloadOutline, mdiChartLine, mdiHarddisk, mdiFolderOutline, mdiEngine } from "@mdi/js";
import Account from "@/pages/Settings/pages/Account";
import Terminal from "@/pages/Settings/pages/Terminal";
import FileManager from "@/pages/Settings/pages/FileManager";
import Keymaps from "@/pages/Settings/pages/Keymaps";
import Identities from "@/pages/Settings/pages/Identities";
import Sessions from "@/pages/Settings/pages/Sessions";
import Organizations from "@/pages/Settings/pages/Organizations";
import Users from "@/pages/Settings/pages/Users";
import Authentication from "@/pages/Settings/pages/Authentication";
import Sources from "@/pages/Settings/pages/Sources";
import Monitoring from "@/pages/Settings/pages/Monitoring";
import Backup from "@/pages/Settings/pages/Backup";
import AI from "@/pages/Settings/pages/AI";
import Engines from "@/pages/Settings/pages/Engines";

export const getSidebarNavigation = t => [
    { title: t('common.sidebar.servers'), key: "servers", path: "/servers", icon: mdiServerOutline, toggleEvent: "toggleServerList" },
    { title: t('common.sidebar.monitoring'), key: "monitoring", path: "/monitoring", icon: mdiChartBoxOutline },
    { title: t('common.sidebar.snippets'), key: "snippets", path: "/snippets", icon: mdiCodeBraces },
    { title: t('common.sidebar.audit'), key: "audit", path: "/audit", icon: mdiShieldCheckOutline },
];

export const getSettingsUserPages = t => [
    { title: t("settings.pages.account"), key: "account", icon: mdiAccountCircleOutline, content: <Account /> },
    { title: t("settings.pages.terminal"), key: "terminal", icon: mdiConsole, content: <Terminal /> },
    { title: t("settings.pages.fileManager"), key: "fileManager", icon: mdiFolderOutline, content: <FileManager /> },
    { title: t("settings.pages.keymaps"), key: "keymaps", icon: mdiKeyboardOutline, content: <Keymaps /> },
    { title: t("settings.pages.identities"), key: "identities", icon: mdiKeyVariant, content: <Identities /> },
    { title: t("settings.pages.sessions"), key: "sessions", icon: mdiClockStarFourPointsOutline, content: <Sessions /> },
    { title: t("settings.pages.organizations"), key: "organizations", icon: mdiDomain, content: <Organizations /> },
];

export const getSettingsAdminPages = t => [
    { title: t("settings.pages.users"), key: "users", icon: mdiAccountGroup, content: <Users /> },
    { title: t("settings.pages.authentication"), key: "authentication", icon: mdiShieldAccountOutline, content: <Authentication /> },
    { title: t("settings.pages.sources"), key: "sources", icon: mdiCloudDownloadOutline, content: <Sources /> },
    { title: t("settings.pages.monitoring"), key: "monitoring", icon: mdiChartLine, content: <Monitoring /> },
    { title: t("settings.pages.engines"), key: "engines", icon: mdiEngine, content: <Engines /> },
    { title: t("settings.pages.backup"), key: "backup", icon: mdiHarddisk, content: <Backup /> },
    { title: t("settings.pages.ai"), key: "ai", icon: mdiCreationOutline, content: <AI /> },
];

export const getAllSettingsPages = t => [...getSettingsUserPages(t), ...getSettingsAdminPages(t)];
