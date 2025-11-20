import React, { useEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiChevronRight } from "@mdi/js";

export const ContextMenuItem = ({
    icon,
    label,
    onClick,
    onClose,
    disabled = false,
    children,
    customContent = null,
    danger = false,
}) => {
    const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
    const itemRef = useRef(null);
    const submenuRef = useRef(null);
    const [submenuPosition, setSubmenuPosition] = useState({ left: "100%", top: 0 });

    const hasSubmenu = children && React.Children.count(children) > 0;

    useEffect(() => {
        if (!isSubmenuOpen) return;

        const updatePosition = () => {
            if (!itemRef.current || !submenuRef.current) return;
            const itemRect = itemRef.current.getBoundingClientRect();
            const submenuRect = submenuRef.current.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;

            setSubmenuPosition({
                left: itemRect.right + submenuRect.width > innerWidth ? `-${submenuRect.width}px` : "100%",
                top: itemRect.top + submenuRect.height > innerHeight ? -(submenuRect.height - itemRect.height) : 0
            });
        };

        const timer = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(updatePosition)), 0);
        return () => clearTimeout(timer);
    }, [isSubmenuOpen]);

    const handleClick = (e) => {
        e.stopPropagation();
        if (disabled) return;
        hasSubmenu ? setIsSubmenuOpen(!isSubmenuOpen) : (onClick?.(e), onClose?.());
    };

    const handleKeyDown = (e) => {
        if (disabled) return;
        const actions = {
            "Enter": () => (e.preventDefault(), handleClick(e)),
            " ": () => (e.preventDefault(), handleClick(e)),
            "ArrowRight": () => hasSubmenu && (e.preventDefault(), e.stopPropagation(), setIsSubmenuOpen(true), 
                setTimeout(() => submenuRef.current?.querySelector('.context-menu-item:not(.disabled)')?.focus(), 50)),
            "ArrowLeft": () => hasSubmenu && isSubmenuOpen && (e.preventDefault(), e.stopPropagation(), 
                setIsSubmenuOpen(false), itemRef.current?.focus()),
            "Escape": () => (e.preventDefault(), e.stopPropagation(), 
                isSubmenuOpen ? (setIsSubmenuOpen(false), itemRef.current?.focus()) : onClose?.())
        };
        actions[e.key]?.();
    };

    const handleSubmenuKeyDown = (e) => {
        const items = submenuRef.current?.querySelectorAll('.context-menu-item:not(.disabled)');
        if (!items?.length) return;

        const navigate = (dir) => (e.preventDefault(), e.stopPropagation(),
            items[(Array.from(items).indexOf(document.activeElement) + dir + items.length) % items.length]?.focus());

        const actions = {
            "ArrowDown": () => navigate(1),
            "ArrowUp": () => navigate(-1),
            "ArrowLeft": () => (e.preventDefault(), e.stopPropagation(), setIsSubmenuOpen(false), itemRef.current?.focus())
        };
        actions[e.key]?.();
    };

    const handleMouseEnter = () => hasSubmenu && !disabled && setIsSubmenuOpen(true);

    const handleMouseLeave = (e) => {
        if (!hasSubmenu || submenuRef.current?.contains(e.relatedTarget) || itemRef.current?.contains(e.relatedTarget)) return;
        setTimeout(() => !submenuRef.current?.matches(':hover') && !itemRef.current?.matches(':hover') && setIsSubmenuOpen(false), 100);
    };

    if (customContent) {
        const handleCustomKeyDown = (e) => (e.key === "Enter" || e.key === " ") && 
            (e.preventDefault(), itemRef.current?.querySelector('.tag-clickable, button, [role="button"]')?.click());

        return (
            <div ref={itemRef} className="context-menu-item custom" role="menuitem" tabIndex={0} onKeyDown={handleCustomKeyDown}>
                {React.isValidElement(customContent) && typeof customContent.type !== 'string' 
                    ? React.cloneElement(customContent, { onClose }) : customContent}
            </div>
        );
    };

    return (
        <div
            ref={itemRef}
            className={`context-menu-item ${disabled ? "disabled" : ""} ${danger ? "danger" : ""} ${hasSubmenu ? "has-submenu" : ""}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            role="menuitem"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-haspopup={hasSubmenu ? "menu" : undefined}
            aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
        >
            {icon && (typeof icon === "string" ? <Icon path={icon} className="menu-icon" /> : <span className="menu-icon">{icon}</span>)}
            <span className="menu-label">{label}</span>
            {hasSubmenu && (
                <>
                    <Icon path={mdiChevronRight} className="submenu-arrow" />
                    {isSubmenuOpen && (
                        <div ref={submenuRef} className="context-menu-submenu"
                             style={submenuPosition} role="menu" aria-orientation="vertical"
                             onKeyDown={handleSubmenuKeyDown}>
                            {React.Children.map(children, (child) => {
                                if (!React.isValidElement(child)) return child;
                                if (child.type === React.Fragment || typeof child.type === 'string') return child;
                                return React.cloneElement(child, { onClose });
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
