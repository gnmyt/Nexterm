import * as mdiIcons from "@mdi/js";

export const getIconPath = (iconName) =>
    (iconName && mdiIcons[iconName]) || mdiIcons.mdiServerOutline;

/** Maps known SSO issuer domains to MDI icon paths */
export const providerIconMap = {
    "login.microsoftonline.com": mdiIcons.mdiMicrosoft,      // Microsoft Entra/Microsoft
    "accounts.google.com": mdiIcons.mdiGoogle,               // Google Workspace
    "appleid.apple.com": mdiIcons.mdiApple,                  // Apple
    "github.com": mdiIcons.mdiGithub,                        // GitHub
    "gitlab.com": mdiIcons.mdiGitlab,                        // GitLab
    "atlassian.com": mdiIcons.mdiAtlassian,                  // Atlassian (Jira/Confluence)
    // Add more as needed...
};

/**
 * Returns the icon (MDI path) for an authentication provider based on issuer URI or a known domain.
 * @param {object} provider - Provider object which should have 'issuer' field.
 */
export function getProviderIcon(provider) {
    // console.log("Provider:", provider);
    // console.log("Checking icon for issuer:", provider.issuer);
    if (!provider?.issuer) return mdiIcons.mdiShieldAccount;
    try {
        // Extract domain from issuer (e.g. https://login.microsoftonline.com/xxx)
        const url = new URL(provider.issuer);
        const domain = url.hostname.toLowerCase();
        // console.log("Mapping provider:", domain, "in map:", Object.keys(providerIconMap));
        return providerIconMap[domain] || mdiIcons.mdiShieldAccount;
    } catch (e) {
        console.debug("Failed to parse issuer for icon:", provider?.issuer, e);
        return mdiIcons.mdiShieldAccount;
    }
}