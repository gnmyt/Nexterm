import { useState, useEffect, useRef } from "react";

let zCounter = 1000;
const nextZ = () => ++zCounter;

const getTopInset = () => {
    if (document.body.classList.contains("session-fullscreen")) return 0;
    return parseFloat(getComputedStyle(document.body).getPropertyValue("--title-bar-height")) || 0;
};

export const useWindowControls = (initialSize = { width: 800, height: 600 }, initialPosition = null) => {
    const windowRef = useRef(null);
    const headerRef = useRef(null);
    const [zIndex, setZIndex] = useState(nextZ);

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
                const topInset = getTopInset();
                const windowHeight = window.innerHeight - topInset;
                setPosition({
                    x: Math.max(0, (windowWidth - size.width) / 2),
                    y: topInset + Math.max(0, (windowHeight - size.height) / 2),
                });
            };
            centerWindow();
        }
    }, []);

    useEffect(() => {
        const clamp = () => {
            setPosition((pos) => {
                const topInset = getTopInset();
                const maxY = Math.max(topInset, window.innerHeight - (windowRef.current?.offsetHeight || 0));
                const maxX = Math.max(0, window.innerWidth - (windowRef.current?.offsetWidth || 0));
                const x = Math.max(0, Math.min(pos.x, maxX));
                const y = Math.max(topInset, Math.min(pos.y, maxY));
                return x === pos.x && y === pos.y ? pos : { x, y };
            });
        };
        const observer = new MutationObserver(clamp);
        observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("resize", clamp);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", clamp);
        };
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

    const focusWindow = () => {
        setZIndex((current) => (current === zCounter ? current : nextZ()));
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging && !isMaximized) {
                const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - size.width));
                const newY = Math.max(getTopInset(), Math.min(e.clientY - dragOffset.y, window.innerHeight - size.height));
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

    const getWindowStyle = () => {
        return isMaximized
            ? { zIndex }
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
        isMaximized,
        focusWindow,
        handleMouseDown,
        handleResizeStart,
        toggleMaximize,
        getWindowStyle,
        getWindowClasses,
    };
};
