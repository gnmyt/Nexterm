import { useSyncExternalStore } from "react";
import i18n from "@/i18n.js";

const subscribe = (listener) => {
    i18n.on("initialized", listener);
    return () => i18n.off("initialized", listener);
};

export const TranslationsReady = ({ children, fallback = null }) =>
    useSyncExternalStore(subscribe, () => i18n.isInitialized) ? children : fallback;

export default TranslationsReady;
