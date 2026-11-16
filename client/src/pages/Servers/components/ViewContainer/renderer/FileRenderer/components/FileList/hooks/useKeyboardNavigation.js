import { useState, useCallback, useEffect, useMemo } from "react";

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
    onDelete,
    onRename,
    onGoUp,
    onNewFolder,
    treeEnabled = false,
    isExpanded,
    onToggleExpand,
}) => {
    const [focusedId, setFocusedId] = useState(null);

    const focusedIndex = useMemo(() => (
        focusedId === null ? -1 : filteredItems.findIndex(item => item.id === focusedId)
    ), [filteredItems, focusedId]);

    const setFocusedIndex = useCallback((index) => setFocusedId(filteredItems[index]?.id ?? null), [filteredItems]);

    const scrollItemIntoView = useCallback((index) => {
        if (index < 0 || index >= filteredItems.length) return;
        const item = filteredItems[index];
        const itemEl = itemRefs.current[item.id];
        if (itemEl) {
            itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [filteredItems, itemRefs]);

    const toggleSelection = useCallback((item) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(s => s.id === item.id);
            if (isSelected) {
                return prev.filter(s => s.id !== item.id);
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
            if (isMod && event.shiftKey && (event.key === 'N' || event.key === 'n')) { event.preventDefault(); onNewFolder?.(); return; }

            const focusedItem = focusedIndex >= 0 ? filteredItems[focusedIndex] : null;
            const targets = selectedItems.length > 0 ? selectedItems : (focusedItem ? [focusedItem] : []);

            if (event.key === 'Delete' && targets.length > 0) { event.preventDefault(); onDelete?.(targets); return; }
            if (event.key === 'F2') {
                const target = selectedItems.length === 1 ? selectedItems[0] : (selectedItems.length === 0 ? focusedItem : null);
                if (target) { event.preventDefault(); onRename?.(target); }
                return;
            }
            if (treeEnabled && focusedItem && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
                event.preventDefault();
                const focusRow = (index) => { setFocusedIndex(index); scrollItemIntoView(index); };
                const expandable = focusedItem.type === 'folder' && !focusedItem.isSymlink;
                if (event.key === 'ArrowRight') {
                    if (!expandable) return;
                    if (!isExpanded?.(focusedItem)) onToggleExpand?.(focusedItem);
                    else if (filteredItems[focusedIndex + 1]?.depth > focusedItem.depth) focusRow(focusedIndex + 1);
                    return;
                }
                if (expandable && isExpanded?.(focusedItem)) { onToggleExpand?.(focusedItem); return; }
                for (let index = focusedIndex - 1; index >= 0; index--) {
                    if (filteredItems[index].depth < focusedItem.depth) { focusRow(index); return; }
                }
                return;
            }
            if ((event.key === 'Backspace' && !isMod) || (event.altKey && event.key === 'ArrowUp')) {
                event.preventDefault();
                onGoUp?.();
                return;
            }

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
                if (event.shiftKey && !selectedItems.some(s => s.id === filteredItems[newIndex].id)) {
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
        scrollItemIntoView, toggleSelection, onDelete, onRename, onGoUp, onNewFolder,
        treeEnabled, isExpanded, onToggleExpand, setFocusedIndex,
    ]);

    return { focusedIndex, setFocusedIndex };
};
