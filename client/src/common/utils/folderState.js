const FOLDER_STATES_KEY = "folder_states";

export const getFolderStates = () => {
    try {
        const stored = localStorage.getItem(FOLDER_STATES_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn("Failed to load folder states from localStorage:", error);
        return {};
    }
};

export const getFolderState = (folderId, defaultState = true) => {
    const states = getFolderStates();
    return states[folderId] !== undefined ? states[folderId] : defaultState;
};

export const setFolderState = (folderId, isOpen) => {
    try {
        const states = getFolderStates();
        states[folderId] = isOpen;
        localStorage.setItem(FOLDER_STATES_KEY, JSON.stringify(states));
    } catch (error) {
        console.warn("Failed to save folder state to localStorage:", error);
    }
};