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
 * @param {object} provider - Provider object which should have 'issuerUri' or similar field.
 */
export function getProviderIcon(provider) {
    console.log("Providers:", providers);
    console.log("Checking icon for issuerUri:", provider.issuerUri);
    if (!provider?.issuerUri) return mdiIcons.mdiShieldAccount;
    try {
        // Extract domain from issuerUri (e.g. https://login.microsoftonline.com/xxx)
        const url = new URL(provider.issuerUri);
        const domain = url.hostname.toLowerCase();
        return providerIconMap[domain] || mdiIcons.mdiShieldAccount;
    } catch (e) {
        console.debug("Failed to parse issuerUri for icon:", provider?.issuerUri, e);
        return mdiIcons.mdiShieldAccount;
    }
}