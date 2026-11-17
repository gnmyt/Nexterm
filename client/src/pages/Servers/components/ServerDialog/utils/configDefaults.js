export const PERFORMANCE_TOGGLES = [
    { key: "enableWallpaper", defaultOn: true },
    { key: "enableTheming", defaultOn: true },
    { key: "enableFontSmoothing", defaultOn: true },
    { key: "enableFullWindowDrag", defaultOn: false },
    { key: "enableDesktopComposition", defaultOn: false },
    { key: "enableMenuAnimations", defaultOn: false },
];

const CONFIG_DEFAULTS = {
    enableAudio: true,
    wakeOnLanEnabled: false,
    ...Object.fromEntries(PERFORMANCE_TOGGLES.map(({ key, defaultOn }) => [key, defaultOn])),
};

export const withConfigDefaults = (config = {}) => {
    const resolved = { ...config };
    for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
        if (resolved[key] === undefined || resolved[key] === null) resolved[key] = value;
    }
    return resolved;
};
