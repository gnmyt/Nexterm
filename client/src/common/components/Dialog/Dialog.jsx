import React, { createContext, useEffect, useRef, useState } from "react";
import "./styles.sass";

export const DialogContext = createContext({});

export const DialogProvider = ({ disableClosing, open, children, onClose }) => {
    const areaRef = useRef();
    const ref = useRef();

    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const closeInner = () => {
        setIsClosing(true);
    };

    useEffect(() => {
        const handleClick = (event) => {
            const isInsideDialog = ref.current?.contains(event.target);
            const isInsidePortal = !!document.getElementById('select-box-portal')?.contains(event.target);
            
            if (!isInsideDialog && !isInsidePortal) {
                if (!disableClosing) closeInner();
            }
        };

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [ref]);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsClosing(false);
        } else if (!isClosing) {
            closeInner();
        }
    }, [open]);

    const handleAnimationEnd = () => {
        if (isClosing) {
            setIsVisible(false);
            setIsClosing(false);
            if (onClose) onClose();
        }
    };

    return (
        <DialogContext.Provider value={closeInner}>
            {isVisible && (
                <div className={`dialog-area ${isClosing ? "dialog-area-hidden" : ""}`} ref={areaRef}>
                    <div className={`dialog ${isClosing ? "dialog-hidden" : ""}`} ref={ref}
                        onAnimationEnd={handleAnimationEnd}>
                        {children}
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
