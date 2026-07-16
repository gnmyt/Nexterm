import { useCallback, useSyncExternalStore } from "react";

const features = new Map();
const listeners = new Set();

export const getDevFeature = (feature, defaultState = false) => {
    return features.has(feature) ? features.get(feature) : defaultState;
};

export const setDevFeature = (feature, isEnabled) => {
    features.set(feature, isEnabled);
    listeners.forEach((listener) => listener());
};

const subscribeToDevFeatures = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useDevFeature = (feature, defaultState = false) => {
    const getSnapshot = useCallback(() => getDevFeature(feature, defaultState), [feature, defaultState]);

    return useSyncExternalStore(subscribeToDevFeatures, getSnapshot);
};

export const registerDevFeatureConsoleApi = () => {
    window.nexterm = {
        ...window.nexterm,
        enableDemo: () => {
            setDevFeature("demo", true);
            console.info("Demo connections enabled for this session.");
            return true;
        },
        disableDemo: () => {
            setDevFeature("demo", false);
            console.info("Demo connections disabled.");
            return false;
        },
    };
};
