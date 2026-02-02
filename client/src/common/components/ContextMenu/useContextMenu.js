import { useState, useCallback, useRef } from "react";

export const useContextMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const triggerRef = useRef(null);

    const open = useCallback((event, customPosition = null) => {
        event?.preventDefault();
        event?.stopPropagation();

        if (customPosition) {
            setPosition(customPosition);
            if (event?.currentTarget) {
                triggerRef.current = event.currentTarget;
            }
        } else if (event) {
            if (event.currentTarget && event.currentTarget.getBoundingClientRect) {
                const rect = event.currentTarget.getBoundingClientRect();
                setPosition({
                    x: rect.left,
                    y: rect.bottom,
                });
                triggerRef.current = event.currentTarget;
            } else {
                setPosition({
                    x: event.pageX || event.clientX,
                    y: event.pageY || event.clientY,
                });
            }
        }

        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current = null;
    }, []);

    const toggle = useCallback((event) => {
        if (isOpen) {
            close();
        } else {
            open(event);
        }
    }, [isOpen, open, close]);

    return {
        isOpen,
        position,
        open,
        close,
        toggle,
        triggerRef: triggerRef.current,
    };
};
