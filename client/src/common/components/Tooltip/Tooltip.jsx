import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";

export const Tooltip = ({ children, text, disabled = false, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const delayTimeoutRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;
        const gap = 12;

        const rightEdge = triggerRect.right + gap + tooltipRect.width;
        const fitsRight = rightEdge <= viewportWidth - margin;
        const fitsLeft = triggerRect.left - gap - tooltipRect.width >= margin;

        let left;
        if (fitsRight) {
            left = triggerRect.right + gap;
        } else if (fitsLeft) {
            left = triggerRect.left - tooltipRect.width - gap;
        } else {
            left = Math.max(margin, viewportWidth - tooltipRect.width - margin);
        }

        const centerY = triggerRect.top + triggerRect.height / 2;
        let top = centerY - (tooltipRect.height / 2);
        top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));

        setTooltipStyle({ position: "fixed", top: `${top}px`, left: `${left}px`, zIndex: 99999 });
    }, []);

    useEffect(() => {
        if (isVisible) {
            requestAnimationFrame(updatePosition);
            window.addEventListener("resize", updatePosition);

            return () => {
                window.removeEventListener("resize", updatePosition);
            };
        }
    }, [isVisible, updatePosition]);

    const handleMouseEnter = useCallback(() => {
        if (disabled || !text) return;
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    }, [disabled, text, delay]);

    const handleMouseLeave = useCallback(() => {
        if (delayTimeoutRef.current) {
            clearTimeout(delayTimeoutRef.current);
            delayTimeoutRef.current = null;
        }
        setIsVisible(false);
    }, []);

    useEffect(() => () => {
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    }, []);

    return (
        <div ref={triggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {children}

            {isVisible && createPortal(
                <div ref={tooltipRef} className="tooltip" style={tooltipStyle}>
                    <div className="tooltip-content">
                        {text}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
