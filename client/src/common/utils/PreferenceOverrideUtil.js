export const getPreferenceOverrideKey = (accountId, group) => {
    if (!accountId || !group) return null;
    return `preference_override:${accountId}:${group}`;
};

export const readPreferenceOverride = (accountId, group) => {
    const key = getPreferenceOverrideKey(accountId, group);
    if (!key) return null;

    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const hasPreferenceOverride = (accountId, group) => {
    const key = getPreferenceOverrideKey(accountId, group);
    if (!key) return false;
    return !!localStorage.getItem(key);
};

export const writePreferenceOverride = (accountId, group, values) => {
    const key = getPreferenceOverrideKey(accountId, group);
    if (!key) return;

    try {
        localStorage.setItem(key, JSON.stringify(values || {}));
    } catch {}
};

export const removePreferenceOverride = (accountId, group) => {
    const key = getPreferenceOverrideKey(accountId, group);
    if (!key) return;

    try {
        localStorage.removeItem(key);
    } catch {}
};
