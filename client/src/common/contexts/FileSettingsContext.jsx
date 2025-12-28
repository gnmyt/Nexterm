import { createContext, useContext, useState, useEffect } from "react";

const FileSettingsContext = createContext({});

export const useFileSettings = () => useContext(FileSettingsContext);

export const FileSettingsProvider = ({ children }) => {
    const [showThumbnails, setShowThumbnails] = useState(() => {
        const saved = localStorage.getItem("file-show-thumbnails");
        return saved !== null ? saved === "true" : true;
    });

    const [defaultViewMode, setDefaultViewMode] = useState(() => {
        const saved = localStorage.getItem("file-default-view-mode");
        return saved || "list";
    });

    const [showHiddenFiles, setShowHiddenFiles] = useState(() => {
        const saved = localStorage.getItem("file-show-hidden");
        return saved !== null ? saved === "true" : false;
    });

    const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(() => {
        const saved = localStorage.getItem("file-confirm-delete");
        return saved !== null ? saved === "true" : true;
    });

    useEffect(() => {
        localStorage.setItem("file-show-thumbnails", showThumbnails.toString());
    }, [showThumbnails]);

    useEffect(() => {
        localStorage.setItem("file-default-view-mode", defaultViewMode);
    }, [defaultViewMode]);

    useEffect(() => {
        localStorage.setItem("file-show-hidden", showHiddenFiles.toString());
    }, [showHiddenFiles]);

    useEffect(() => {
        localStorage.setItem("file-confirm-delete", confirmBeforeDelete.toString());
    }, [confirmBeforeDelete]);

    const toggleThumbnails = () => setShowThumbnails(prev => !prev);
    const toggleHiddenFiles = () => setShowHiddenFiles(prev => !prev);
    const toggleConfirmBeforeDelete = () => setConfirmBeforeDelete(prev => !prev);

    return (
        <FileSettingsContext.Provider value={{
            showThumbnails,
            setShowThumbnails,
            toggleThumbnails,
            defaultViewMode,
            setDefaultViewMode,
            showHiddenFiles,
            setShowHiddenFiles,
            toggleHiddenFiles,
            confirmBeforeDelete,
            setConfirmBeforeDelete,
            toggleConfirmBeforeDelete,
        }}>
            {children}
        </FileSettingsContext.Provider>
    );
};
