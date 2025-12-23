import React, { useEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiChevronRight, mdiChevronDown } from "@mdi/js";

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
    const [isMobile, setIsMobile] = useState(false);

    const hasSubmenu = children && React.Children.count(children) > 0;

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!isSubmenuOpen || !submenuRef.current) return;

        const updatePosition = () => {
            if (!itemRef.current || !submenuRef.current) return;
            const itemRect = itemRef.current.getBoundingClientRect();
            const submenuRect = submenuRef.current.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;

            if (isMobile) return setSubmenuPosition({ left: 0, top: "100%", position: "relative", width: "100%" });

            let left = "100%";
            if (itemRect.right + submenuRect.width > innerWidth) {
                if (itemRect.left - submenuRect.width >= 0) {
                    left = `-${submenuRect.width}px`;
                } else {
                    const availableRight = innerWidth - itemRect.right - 10;
                    const availableLeft = itemRect.left - 10;
                    left = availableLeft > availableRight ? `-${Math.min(submenuRect.width, availableLeft)}px` : "100%";
                }
            }

            const top = itemRect.top + submenuRect.height > innerHeight
                ? Math.max(-(submenuRect.height - itemRect.height), -(itemRect.top - 10))
                : 0;

            setSubmenuPosition({ left, top });
        };

        const timer = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(updatePosition)), 0);

        const observer = new MutationObserver(() => {
            requestAnimationFrame(updatePosition);
        });

        observer.observe(submenuRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        window.addEventListener('resize', updatePosition);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
            window.removeEventListener('resize', updatePosition);
        };
    }, [isSubmenuOpen, isMobile]);

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
            className={`context-menu-item ${disabled ? "disabled" : ""} ${danger ? "danger" : ""} ${hasSubmenu ? "has-submenu" : ""} ${isSubmenuOpen && isMobile ? "submenu-open-mobile" : ""}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={!isMobile ? handleMouseEnter : undefined}
            onMouseLeave={!isMobile ? handleMouseLeave : undefined}
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
                    <Icon path={isMobile ? mdiChevronDown : mdiChevronRight} className={`submenu-arrow ${isSubmenuOpen ? "open" : ""}`} />
                    {isSubmenuOpen && (
                        <div ref={submenuRef} className={`context-menu-submenu ${isMobile ? "mobile" : ""}`}
                             style={!isMobile ? submenuPosition : undefined} role="menu" aria-orientation="vertical"
                             onKeyDown={handleSubmenuKeyDown}
                             onClick={(e) => e.stopPropagation()}>
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
