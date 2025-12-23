import { useState, useEffect, useRef } from "react";

export const useWindowControls = (initialSize = { width: 800, height: 600 }, initialPosition = null) => {
    const windowRef = useRef(null);
    const headerRef = useRef(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
    const [size, setSize] = useState(initialSize);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    useEffect(() => {
        if (!initialPosition) {
            const centerWindow = () => {
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                setPosition({
                    x: Math.max(0, (windowWidth - size.width) / 2),
                    y: Math.max(0, (windowHeight - size.height) / 2),
                });
            };
            centerWindow();
        }
    }, []);

    const handleMouseDown = (e) => {
        if (e.target !== headerRef.current && !headerRef.current.contains(e.target)) return;
        if (isMaximized) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };

    const handleResizeStart = (e) => {
        e.stopPropagation();
        if (isMaximized) return;
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
        });
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging && !isMaximized) {
                const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - size.width));
                const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - size.height));
                setPosition({ x: newX, y: newY });
            } else if (isResizing && !isMaximized) {
                const deltaX = e.clientX - resizeStart.x;
                const deltaY = e.clientY - resizeStart.y;
                const newWidth = Math.max(400, Math.min(resizeStart.width + deltaX, window.innerWidth - position.x));
                const newHeight = Math.max(300, Math.min(resizeStart.height + deltaY, window.innerHeight - position.y));
                setSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, isResizing, dragOffset, position, size, resizeStart, isMaximized]);

    const getWindowStyle = (zIndex = 9999) => {
        return isMaximized
            ? { top: 0, left: 0, width: "100vw", height: "100vh", zIndex }
            : {
                top: `${position.y}px`,
                left: `${position.x}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                zIndex,
            };
    };

    const getWindowClasses = (baseClass) => {
        const classes = [baseClass];
        if (isMaximized) classes.push("maximized");
        if (isDragging) classes.push("dragging");
        return classes.join(" ");
    };

    return {
        windowRef,
        headerRef,
        isDragging,
        isResizing,
        isMaximized,
        position,
        size,
        handleMouseDown,
        handleResizeStart,
        toggleMaximize,
        getWindowStyle,
        getWindowClasses,
    };
};
