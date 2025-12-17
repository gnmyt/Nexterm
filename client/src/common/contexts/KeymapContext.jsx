import { createContext, useContext, useEffect, useState } from "react";
import { getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";

export const KeymapContext = createContext({});

export const useKeymaps = () => {
    const context = useContext(KeymapContext);
    if (!context) throw new Error("useKeymaps must be used within a KeymapProvider");
    return context;
};

const isMac = () =>
    navigator.userAgentData
        ? navigator.userAgentData.platform === "macOS"
        : /Mac/i.test(navigator.userAgent);

const parseKeybind = (keybind) => {
    if (!keybind) return null;
    
    const parts = keybind.toLowerCase().split("+");
    return {
        ctrl: parts.includes("ctrl"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
        meta: parts.includes("meta"),
        key: parts[parts.length - 1],
        original: keybind
    };
};

export const matchesKeybind = (event, parsedKeybind) => {
    if (!parsedKeybind) return false;

    const mac = isMac();

    // key
    if (event.key.toLowerCase() !== parsedKeybind.key) return false;

    // ctrl / cmd handling
    if (parsedKeybind.ctrl) {
        if (mac) {
            if (!(event.ctrlKey || event.metaKey)) return false;
        } else {
            if (!event.ctrlKey) return false;
        }
    } else {
        if (event.ctrlKey) return false;
    }

    // meta (explicit only)
    if (parsedKeybind.meta && !event.metaKey) return false;
    if (!parsedKeybind.meta && event.metaKey && !parsedKeybind.ctrl) return false;

    if (event.shiftKey !== parsedKeybind.shift) return false;
    if (event.altKey !== parsedKeybind.alt) return false;

    return true;
};

export const KeymapProvider = ({ children }) => {
    const { user } = useContext(UserContext);
    const [keymaps, setKeymaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [parsedKeybinds, setParsedKeybinds] = useState({});

    const loadKeymaps = async () => {
        if (!user) return;
        
        try {
            setLoading(true);
            const data = await getRequest("keymaps");
            setKeymaps(data);
            
            const parsed = {};
            data.forEach(keymap => {
                if (keymap.enabled) parsed[keymap.action] = parseKeybind(keymap.key);
            });
            setParsedKeybinds(parsed);
        } catch (error) {
            console.error("Failed to load keymaps:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateKeymap = async (action, updates) => {
        try {
            await patchRequest(`keymaps/${action}`, updates);
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to update keymap:", error);
            throw error;
        }
    };

    const resetKeymap = async (action) => {
        try {
            await postRequest(`keymaps/${action}/reset`);
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to reset keymap:", error);
            throw error;
        }
    };

    const resetAllKeymaps = async () => {
        try {
            await postRequest("keymaps/reset");
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to reset all keymaps:", error);
            throw error;
        }
    };

    const getKeymap = (action) => keymaps.find(k => k.action === action);
    const getKeybind = (action) => getKeymap(action)?.enabled ? getKeymap(action).key : null;
    const getParsedKeybind = (action) => parsedKeybinds[action] || null;
    const formatKey = (key) => {
        if (!key) return "";

        const mac = isMac();

        return key
            .split("+")
            .map(k => {
                if (mac && k === "ctrl") return "⌘";
                if (k === "meta") return mac ? "⌘" : "META";
                return k.toUpperCase();
            })
            .join(" + ");
    };



    useEffect(() => {
        if (user) {
            loadKeymaps();
        }
    }, [user]);

    return (
        <KeymapContext.Provider value={{
            keymaps,
            loading,
            loadKeymaps,
            updateKeymap,
            resetKeymap,
            resetAllKeymaps,
            getKeymap,
            getKeybind,
            getParsedKeybind,
            formatKey,
            matchesKeybind,
        }}>
            {children}
        </KeymapContext.Provider>
    );
};
