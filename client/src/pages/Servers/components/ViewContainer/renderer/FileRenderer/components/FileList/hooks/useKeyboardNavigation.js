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
            if (renamingItem || creatingFolder || creatingFile) return;
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

                let newIndex;
                if (focusedIndex === -1) {
                    newIndex = event.key === 'ArrowDown' ? 0 : filteredItems.length - 1;
                } else {
                    if (event.key === 'ArrowDown') {
                        newIndex = Math.min(focusedIndex + 1, filteredItems.length - 1);
                    } else {
                        newIndex = Math.max(focusedIndex - 1, 0);
                    }
                }

                setFocusedIndex(newIndex);
                scrollItemIntoView(newIndex);

                if (event.shiftKey) {
                    const item = filteredItems[newIndex];
                    if (!selectedItems.some(s => s.name === item.name)) {
                        setSelectedItems(prev => [...prev, item]);
                    }
                }
                return;
            }

            if (event.key === 'Home') {
                event.preventDefault();
                setFocusedIndex(0);
                scrollItemIntoView(0);
                return;
            }
            if (event.key === 'End') {
                event.preventDefault();
                const lastIndex = filteredItems.length - 1;
                setFocusedIndex(lastIndex);
                scrollItemIntoView(lastIndex);
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
        isActive, renamingItem, creatingFolder, creatingFile, focusedIndex, filteredItems,
        selectedItems, setSelectedItems, handleCopy, handleCut, handlePaste, handleClick,
        scrollItemIntoView, toggleSelection,
    ]);

    useEffect(() => setFocusedIndex(-1), [filteredItems]);

    return { focusedIndex, setFocusedIndex };
};
