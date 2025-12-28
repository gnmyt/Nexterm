import { useState, useCallback, useEffect } from "react";

export const useBoxSelection = ({ containerRef, itemRefs, filteredItems, onSelectionChange }) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState(null);
    const [selectionStart, setSelectionStart] = useState(null);

    const getRelativeCoords = useCallback((event) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: event.clientX - rect.left + containerRef.current.scrollLeft,
            y: event.clientY - rect.top + containerRef.current.scrollTop,
        };
    }, [containerRef]);

    const rectsIntersect = (r1, r2) => (
        !(r2.left > r1.left + r1.width || r2.left + r2.width < r1.left || r2.top > r1.top + r1.height || r2.top + r2.height < r1.top)
    );

    const handleSelectionStart = useCallback((event) => {
        if (event.button !== 0 || event.target.closest('.file-item')) return;
        const coords = getRelativeCoords(event);
        setSelectionStart(coords);
        setIsSelecting(true);
        setSelectionBox({ left: coords.x, top: coords.y, width: 0, height: 0 });
        if (!event.ctrlKey && !event.metaKey) onSelectionChange([]);
    }, [getRelativeCoords, onSelectionChange]);

    const handleSelectionMove = useCallback((event) => {
        if (!isSelecting || !selectionStart) return;
        const coords = getRelativeCoords(event);
        const rect = {
            left: Math.min(selectionStart.x, coords.x),
            top: Math.min(selectionStart.y, coords.y),
            width: Math.abs(coords.x - selectionStart.x),
            height: Math.abs(coords.y - selectionStart.y),
        };
        setSelectionBox(rect);

        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        
        const newSelected = filteredItems.filter((item) => {
            const itemEl = itemRefs.current[item.name];
            if (!itemEl) return false;
            const itemRect = itemEl.getBoundingClientRect();
            const itemRelRect = {
                left: itemRect.left - containerRect.left + container.scrollLeft,
                top: itemRect.top - containerRect.top + container.scrollTop,
                width: itemRect.width,
                height: itemRect.height,
            };
            return rectsIntersect(rect, itemRelRect);
        });
        onSelectionChange(newSelected);
    }, [isSelecting, selectionStart, getRelativeCoords, containerRef, filteredItems, itemRefs, onSelectionChange]);

    const handleSelectionEnd = useCallback(() => {
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
    }, []);

    useEffect(() => {
        if (!isSelecting) return;
        const handleMove = (e) => handleSelectionMove(e);
        const handleUp = () => handleSelectionEnd();
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
    }, [isSelecting, handleSelectionMove, handleSelectionEnd]);

    return { isSelecting, selectionBox, handleSelectionStart };
};
