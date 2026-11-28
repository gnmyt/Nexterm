import { useSyncExternalStore } from "react";
import {
    mdiAccessPoint, mdiApi, mdiApple, mdiAtlassian, mdiAws, mdiCentos, mdiCloud,
    mdiCodeBraces, mdiConsole, mdiCube, mdiDatabase, mdiDebian,
    mdiDesktopClassic, mdiDocker, mdiFedora, mdiFlaskOutline, mdiFolderNetwork, mdiFreebsd,
    mdiGentoo, mdiGit, mdiGithub, mdiGitlab, mdiGoogle, mdiGoogleCloud, mdiKubernetes, mdiLaptop, mdiLinux,
    mdiMicrosoft, mdiMicrosoftAzure, mdiMicrosoftWindows, mdiMonitor, mdiNas, mdiRaspberryPi, mdiRedhat,
    mdiRouter, mdiServer, mdiServerNetwork, mdiServerOutline, mdiShieldAccount, mdiUbuntu, mdiWebhook,
} from "@mdi/js";
import { loadIcon } from "virtual:mdi-icon-set";

export const POPULAR_ICONS = {
    mdiServerOutline, mdiMicrosoftWindows, mdiLinux, mdiDebian, mdiUbuntu,
    mdiFedora, mdiApple, mdiDocker, mdiKubernetes, mdiDatabase,
    mdiCloud, mdiRaspberryPi, mdiConsole, mdiMonitor, mdiCube,
    mdiFreebsd, mdiServer, mdiDesktopClassic, mdiLaptop, mdiNas,
    mdiRouter, mdiAccessPoint, mdiWebhook, mdiApi, mdiCodeBraces,
    mdiGit, mdiGithub, mdiGitlab, mdiAws, mdiMicrosoftAzure,
    mdiGoogleCloud, mdiRedhat,
    mdiCentos, mdiGentoo,
};

const known = new Map(Object.entries({ ...POPULAR_ICONS, mdiFolderNetwork, mdiFlaskOutline, mdiServerNetwork }));
const requested = new Set();
const listeners = new Set();

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const request = (iconName) => {
    if (requested.has(iconName)) return;
    requested.add(iconName);
    loadIcon(iconName).then((path) => {
        if (!path) return;
        known.set(iconName, path);
        listeners.forEach((listener) => listener());
    }, () => requested.delete(iconName));
};

const getIconPath = (iconName) => {
    if (!iconName) return mdiServerOutline;
    const path = known.get(iconName);
    if (!path && /^mdi[A-Z]/.test(iconName)) request(iconName);
    return path || mdiServerOutline;
};

export const useIconPath = (iconName) => useSyncExternalStore(subscribe, () => getIconPath(iconName));

export const providerIconMap = {
    "login.microsoftonline.com": mdiMicrosoft,
    "accounts.google.com": mdiGoogle,
    "appleid.apple.com": mdiApple,
    "github.com": mdiGithub,
    "gitlab.com": mdiGitlab,
    "atlassian.com": mdiAtlassian,
};

export function getProviderIcon(provider) {
    if (!provider?.issuer) return mdiShieldAccount;
    try {
        const url = new URL(provider.issuer);
        const domain = url.hostname.toLowerCase();
        return providerIconMap[domain] || mdiShieldAccount;
    } catch (e) {
        console.debug("Failed to parse issuer for icon:", provider?.issuer, e);
        return mdiShieldAccount;
    }
}
