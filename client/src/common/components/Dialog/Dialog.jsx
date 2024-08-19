import React, { createContext, useEffect, useRef, useState } from "react";
import "./styles.sass";

export const DialogContext = createContext({});

export const DialogProvider = ({ disableClosing, open, children }) => {
    const areaRef = useRef();
    const ref = useRef();

    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const closeInner = () => {
        setIsClosing(true);
    };

    useEffect(() => {
        const handleClick = (event) => {
            if (!ref.current?.contains(event.target)) {
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
