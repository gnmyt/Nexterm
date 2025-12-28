import { useState, useCallback, useEffect } from "react";

export const useKeyboardNavigation = ({
    isActive,
    filteredItems,
    selectedItems,
    setSelectedItems,
    itemRefs,
    renamingItem,
    creatingFolder,
    creatingFile,
    contextMenuOpen,
    handleCopy,
    handleCut,
    handlePaste,
    handleClick,
}) => {
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const scrollItemIntoView = useCallback((index) => {
        if (index < 0 || index >= filteredItems.length) return;
        const item = filteredItems[index];
        const itemEl = itemRefs.current[item.name];
        if (itemEl) {
            itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [filteredItems, itemRefs]);

    const toggleSelection = useCallback((item) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(s => s.name === item.name);
            if (isSelected) {
                return prev.filter(s => s.name !== item.name);
            }
            return [...prev, item];
        });
    }, [setSelectedItems]);

    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (event) => {
            if (renamingItem || creatingFolder || creatingFile || contextMenuOpen) return;
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

            const isMod = event.ctrlKey || event.metaKey;

            if (isMod && event.key === 'c') { event.preventDefault(); handleCopy(); return; }
            if (isMod && event.key === 'x') { event.preventDefault(); handleCut(); return; }
            if (isMod && event.key === 'v') { event.preventDefault(); handlePaste(); return; }
            if (isMod && event.key === 'a') { event.preventDefault(); setSelectedItems(filteredItems); return; }

            if (event.key === 'Escape') {
                if (selectedItems.length > 0) {
                    setSelectedItems([]);
                    setFocusedIndex(-1);
                }
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (filteredItems.length === 0) return;
                const newIndex = focusedIndex === -1
                    ? (event.key === 'ArrowDown' ? 0 : filteredItems.length - 1)
                    : Math.max(0, Math.min(filteredItems.length - 1, focusedIndex + (event.key === 'ArrowDown' ? 1 : -1)));
                setFocusedIndex(newIndex);
                scrollItemIntoView(newIndex);
                if (event.shiftKey && !selectedItems.some(s => s.name === filteredItems[newIndex].name)) {
                    setSelectedItems(prev => [...prev, filteredItems[newIndex]]);
                }
                return;
            }

            if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                const idx = event.key === 'Home' ? 0 : filteredItems.length - 1;
                setFocusedIndex(idx);
                scrollItemIntoView(idx);
                return;
            }

            if (event.key === ' ' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
                event.preventDefault();
                toggleSelection(filteredItems[focusedIndex]);
                return;
            }

            if (event.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
                event.preventDefault();
                handleClick(filteredItems[focusedIndex]);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [
        isActive, renamingItem, creatingFolder, creatingFile, contextMenuOpen, focusedIndex, filteredItems,
        selectedItems, setSelectedItems, handleCopy, handleCut, handlePaste, handleClick,
        scrollItemIntoView, toggleSelection,
    ]);

    useEffect(() => setFocusedIndex(-1), [filteredItems]);

    return { focusedIndex, setFocusedIndex };
};
