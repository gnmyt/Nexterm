import { useState, useRef, useEffect, useCallback } from "react";
import "./styles.sass";

export const Tooltip = ({ children, text, disabled = false }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        const centerY = triggerRect.top + triggerRect.height / 2;
        const left = triggerRect.right + 12;

        const viewportWidth = window.innerWidth;
        const adjustedLeft = left + tooltipRect.width > viewportWidth - 8 ? triggerRect.left - tooltipRect.width - 12 : left;

        const adjustedTop = centerY - (tooltipRect.height / 2);

        setTooltipStyle({ position: "fixed", top: `${adjustedTop}px`, left: `${adjustedLeft}px`, zIndex: 99999 });
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
        if (!disabled && text) setIsVisible(true);
    }, [disabled, text]);

    const handleMouseLeave = useCallback(() => {
        setIsVisible(false);
    }, []);

    return (
        <div ref={triggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {children}

            {isVisible && (
                <div ref={tooltipRef} className="tooltip" style={tooltipStyle}>
                    <div className="tooltip-content">
                        {text}
                    </div>
                </div>
            )}
        </div>
    );
};
