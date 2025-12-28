import { useState, useCallback } from "react";

export const useClipboard = ({ selectedItems, selectedItem, path, copyFiles, moveFiles }) => {
    const [clipboard, setClipboard] = useState(null);

    const handleCopy = useCallback(() => {
        const items = selectedItems.length > 0 ? selectedItems : (selectedItem ? [selectedItem] : []);
        if (items.length > 0) {
            setClipboard({ paths: items.map(item => `${path}/${item.name}`), operation: 'copy' });
        }
    }, [selectedItems, selectedItem, path]);

    const handleCut = useCallback(() => {
        const items = selectedItems.length > 0 ? selectedItems : (selectedItem ? [selectedItem] : []);
        if (items.length > 0) {
            setClipboard({ paths: items.map(item => `${path}/${item.name}`), operation: 'cut' });
        }
    }, [selectedItems, selectedItem, path]);

    const handlePaste = useCallback(() => {
        if (!clipboard?.paths?.length) return;
        if (clipboard.operation === 'copy') {
            copyFiles?.(clipboard.paths, path);
        } else {
            moveFiles?.(clipboard.paths, path);
            setClipboard(null);
        }
    }, [clipboard, path, copyFiles, moveFiles]);

    const isItemCut = useCallback((itemPath) => {
        return clipboard?.operation === 'cut' && clipboard.paths.some(p => p === itemPath);
    }, [clipboard]);

    return { handleCopy, handleCut, handlePaste, isItemCut };
};
