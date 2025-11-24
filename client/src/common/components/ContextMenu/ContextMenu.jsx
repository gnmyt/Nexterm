import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";

export const ContextMenu = ({ 
    isOpen, 
    position, 
    onClose, 
    children,
    trigger = null 
}) => {
    const menuRef = useRef(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const processChildren = (childrenToProcess) => {
        return React.Children.map(childrenToProcess, (child) => {
            if (!React.isValidElement(child)) return child;

            const { type } = child;
            if (type === React.Fragment) {
                return React.cloneElement(child, {}, processChildren(child.props.children));
            }
            if (typeof type === 'string') return child;
            return React.cloneElement(child, { onClose });
        });
    };

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setAdjustedPosition(position);
            requestAnimationFrame(() => requestAnimationFrame(() => setIsPositioned(true)));
        } else {
            setIsPositioned(false);
        }
    }, [isOpen, position]);

    const handleAnimationEnd = (e) => {
        if (e.target === menuRef.current && !isOpen) {
            setIsVisible(false);
            setIsPositioned(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !isPositioned || !menuRef.current) return;

        const menuRect = menuRef.current.getBoundingClientRect();
        const { innerWidth, innerHeight } = window;
        let { x, y } = position;

        x = Math.max(10, Math.min(x, innerWidth - menuRect.width - 10));
        y = Math.max(10, Math.min(y, innerHeight - menuRect.height - 10));

        setAdjustedPosition({ x, y });
    }, [isOpen, isPositioned, position]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) && 
                !(trigger?.contains?.(e.target))) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") return onClose();

            const items = menuRef.current?.querySelectorAll('.context-menu-item:not(.disabled):not(.custom)');
            if (!items?.length) return;

            const navigate = (dir) => {
                e.preventDefault();
                const currentIndex = Array.from(items).indexOf(document.activeElement);
                const nextIndex = (currentIndex + dir + items.length) % items.length;
                items[nextIndex]?.focus();
            };

            if (e.key === "ArrowDown") navigate(1);
            if (e.key === "ArrowUp") navigate(-1);
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        setTimeout(() => menuRef.current?.querySelector('.context-menu-item:not(.disabled):not(.custom)')?.focus(), 50);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose, trigger]);

    if (!isVisible) return null;

    const menu = (
        <div
            ref={menuRef}
            className={`context-menu ${isOpen && isPositioned ? 'open' : 'closed'}`}
            style={{
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
            }}
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
            onTransitionEnd={handleAnimationEnd}
        >
            {processChildren(children)}
        </div>
    );

    return createPortal(menu, document.body);
};
