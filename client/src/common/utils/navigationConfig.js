import { mdiServerOutline, mdiCodeBraces, mdiChartBoxOutline, mdiShieldCheckOutline, mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline, mdiShieldAccountOutline, mdiDomain, mdiCreationOutline, mdiKeyVariant, mdiConsole, mdiKeyboardOutline, mdiCloudDownloadOutline, mdiChartLine } from "@mdi/js";

export const getSidebarNavigation = t => [
    { title: t('common.sidebar.servers'), key: "servers", path: "/servers", icon: mdiServerOutline, toggleEvent: "toggleServerList" },
    { title: t('common.sidebar.monitoring'), key: "monitoring", path: "/monitoring", icon: mdiChartBoxOutline },
    { title: t('common.sidebar.snippets'), key: "snippets", path: "/snippets", icon: mdiCodeBraces },
    { title: t('common.sidebar.audit'), key: "audit", path: "/audit", icon: mdiShieldCheckOutline },
];

export const getSettingsUserPages = t => [
    { title: t("settings.pages.account"), routeKey: "account", icon: mdiAccountCircleOutline },
    { title: t("settings.pages.terminal"), routeKey: "terminal", icon: mdiConsole },
    { title: t("settings.pages.keymaps"), routeKey: "keymaps", icon: mdiKeyboardOutline },
    { title: t("settings.pages.identities"), routeKey: "identities", icon: mdiKeyVariant },
    { title: t("settings.pages.sessions"), routeKey: "sessions", icon: mdiClockStarFourPointsOutline },
    { title: t("settings.pages.organizations"), routeKey: "organizations", icon: mdiDomain },
];

export const getSettingsAdminPages = t => [
    { title: t("settings.pages.users"), routeKey: "users", icon: mdiAccountGroup },
    { title: t("settings.pages.authentication"), routeKey: "authentication", icon: mdiShieldAccountOutline },
    { title: t("settings.pages.sources"), routeKey: "sources", icon: mdiCloudDownloadOutline },
    { title: t("settings.pages.monitoring"), routeKey: "monitoring", icon: mdiChartLine },
    { title: t("settings.pages.ai"), routeKey: "ai", icon: mdiCreationOutline },
];

export const getAllSettingsPages = t => [...getSettingsUserPages(t), ...getSettingsAdminPages(t)];
