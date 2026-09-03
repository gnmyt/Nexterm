import { useState, useCallback, useRef } from "react";

const DRAG_MIME = "application/x-sftp-files";

const withTrailingSlash = (path) => (path.endsWith("/") ? path : path + "/");

export const useDragDrop = ({ path, sessionId, selectedItems, isItemSelected, moveFiles, copyFiles, transferFromSession, dragDropAction, updatePath }) => {
    const [draggedItems, setDraggedItems] = useState([]);
    const [dropTarget, setDropTarget] = useState(null);
    const [pendingDrop, setPendingDrop] = useState(null);
    const dragImageRef = useRef(null);
    const hoverTimerRef = useRef(null);

    const clearHoverTimer = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    };

    const handleDragStart = useCallback((event, item) => {
        const itemsToDrag = isItemSelected(item) ? selectedItems : [item];
        setDraggedItems(itemsToDrag);
        const paths = itemsToDrag.map(i => `${path}/${i.name}`);
        const dragData = { paths, items: itemsToDrag, sessionId };
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragData));
        event.dataTransfer.effectAllowed = "copyMove";

        if (dragImageRef.current) {
            const preview = dragImageRef.current;
            const iconsContainer = preview.querySelector('.drag-icons');
            const badge = preview.querySelector('.drag-badge');
            if (iconsContainer && badge) {
                iconsContainer.querySelectorAll('.drag-icon-wrapper').forEach(el => el.remove());
                itemsToDrag.slice(0, 3).reverse().forEach((dragItem, idx) => {
                    const reverseIdx = Math.min(itemsToDrag.length, 3) - 1 - idx;
                    const iconWrapper = document.createElement('div');
                    iconWrapper.className = 'drag-icon-wrapper';
                    iconWrapper.style.cssText = `transform:translate(${reverseIdx * 6}px,${reverseIdx * 6}px);z-index:${idx + 1}`;
                    iconWrapper.innerHTML = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${dragItem.type === 'folder' ? 'M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z' : 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'}"/></svg>`;
                    iconsContainer.insertBefore(iconWrapper, badge);
                });
                badge.textContent = itemsToDrag.length > 1 ? itemsToDrag.length : '';
                badge.style.display = itemsToDrag.length > 1 ? 'flex' : 'none';
                event.dataTransfer.setDragImage(preview, -5, -5);
            }
        }
    }, [selectedItems, isItemSelected, path, sessionId]);

    const handleDragEnd = useCallback(() => {
        setDraggedItems([]);
        setDropTarget(null);
        clearHoverTimer();
    }, []);

    const handleDragOver = useCallback((event, item) => {
        if (item.type !== "folder" || !event.dataTransfer.types.includes(DRAG_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        if (dropTarget !== item.name) {
            setDropTarget(item.name);
            clearHoverTimer();
            hoverTimerRef.current = setTimeout(() => {
                updatePath(`${withTrailingSlash(path)}${item.name}`);
                setDropTarget(null);
            }, 800);
        }
    }, [dropTarget, path, updatePath]);

    const handleDragLeave = useCallback((event) => {
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
        setDropTarget(null);
        clearHoverTimer();
    }, []);

    const readDragData = (event) => {
        try {
            const data = JSON.parse(event.dataTransfer.getData(DRAG_MIME));
            return data?.paths?.length ? data : null;
        } catch {
            return null;
        }
    };

    const executeDrop = useCallback(({ paths, sourceSessionId, destination, action }) => {
        if (action !== "move" && action !== "copy") return false;
        if (sourceSessionId !== sessionId) transferFromSession?.(paths, sourceSessionId, destination, action);
        else if (action === "move") moveFiles?.(paths, destination);
        else copyFiles?.(paths, destination);
        return true;
    }, [sessionId, moveFiles, copyFiles, transferFromSession]);

    const settleDrop = useCallback((event, drop, onClearSelection, openDropMenu) => {
        if (executeDrop({ ...drop, action: dragDropAction })) {
            onClearSelection();
            return;
        }
        setPendingDrop(drop);
        openDropMenu(event);
    }, [executeDrop, dragDropAction]);

    const handleDrop = useCallback((event, item, onClearSelection, openDropMenu) => {
        event.preventDefault();
        event.stopPropagation();
        clearHoverTimer();
        setDropTarget(null);
        setDraggedItems([]);
        if (item.type !== "folder") return;
        const data = readDragData(event);
        if (!data) return;
        const sameSession = data.sessionId === sessionId;
        if (sameSession && data.items?.some(d => d.name === item.name)) return;
        const destination = `${withTrailingSlash(path)}${item.name}`;
        settleDrop(event, { paths: data.paths, sourceSessionId: data.sessionId, destination }, onClearSelection, openDropMenu);
    }, [path, sessionId, settleDrop]);

    const handleContainerDrop = useCallback((event, onClearSelection, openDropMenu) => {
        event.preventDefault();
        event.stopPropagation();
        setDraggedItems([]);
        const data = readDragData(event);
        if (!data) return;
        if (data.sessionId === sessionId) {
            const currentDir = path.endsWith("/") ? path.slice(0, -1) : path;
            const alreadyHere = data.paths.every(p => { const parent = p.substring(0, p.lastIndexOf("/")) || "/"; return parent === currentDir || parent === path; });
            if (alreadyHere) return;
        }
        settleDrop(event, { paths: data.paths, sourceSessionId: data.sessionId, destination: path }, onClearSelection, openDropMenu);
    }, [path, sessionId, settleDrop]);

    const handleDropAction = useCallback((action, onClearSelection, closeDropMenu) => {
        if (pendingDrop) {
            executeDrop({ ...pendingDrop, action });
            onClearSelection();
            setPendingDrop(null);
        }
        closeDropMenu();
    }, [pendingDrop, executeDrop]);

    return {
        draggedItems,
        dropTarget,
        dragImageRef,
        pendingDrop,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleContainerDrop,
        handleDropAction,
        setPendingDrop,
    };
};
