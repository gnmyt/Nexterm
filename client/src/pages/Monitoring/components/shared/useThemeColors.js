import { useEffect, useState } from "react";

const TOKENS = {
    primary: "--primary",
    text: "--white",
    subtext: "--subtext",
    grid: "--dark-gray",
    border: "--gray",
    surface: "--gray-full",
};

const readColors = () => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(Object.entries(TOKENS).map(([key, token]) => [key, styles.getPropertyValue(token).trim()]));
};

export const useThemeColors = () => {
    const [colors, setColors] = useState(readColors);

    useEffect(() => {
        const update = () => setColors(prev => {
            const next = readColors();
            return Object.keys(next).every(key => next[key] === prev[key]) ? prev : next;
        });

        const rootObserver = new MutationObserver(update);
        rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "class"] });
        const headObserver = new MutationObserver(update);
        headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });

        return () => {
            rootObserver.disconnect();
            headObserver.disconnect();
        };
    }, []);

    return colors;
};
